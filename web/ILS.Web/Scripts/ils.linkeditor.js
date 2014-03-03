﻿Ext.require(['Ext.draw.Component', 'Ext.Window']);

Ext.define('EduObject', {
    extend: 'Ext.data.Model',
    fields: [
        { name: 'name', type: 'string' },
        { name: 'id', type: 'string' }
    ]
});

var courseStore = Ext.create('Ext.data.Store', {
    model: 'EduObject',
    proxy: {
        type: 'ajax',
        url: link_readCourses,
        reader: {
            type: 'json',
            root: 'courses'
        }
    },
    autoLoad: true
});

var themeStore = Ext.create('Ext.data.Store', {
    model: 'EduObject',
    proxy: {
        type: 'ajax',
        url: link_readThemes,
        noCache: true,
        extraParams: {
            courseId: null
        },
        reader: {
            type: 'json',
            root: 'courses'
        }
    },
    autoLoad: true
});

var typeStore = Ext.create('Ext.data.Store', {
    fields: ['id', 'name'],
    data: [
        { "id": "course", "name": "Курс" },
        { "id": "theme", "name": "Тема" }
    ]
});

//jsPlumb instance
var instance;

initEditor = function () {
    //flag for same block connection or duplicate connection automatic removing without confirmation 
    var isAutoConnectionDelete = false;
    var selectedId = (Ext.getCmp('typecmb').getValue() == 'theme') ? Ext.getCmp('themecmb').getValue() : Ext.getCmp('coursecmb').getValue();

    if (selectedId == null || selectedId == '') {
        createAndShowNewReportWindow('Предупреждение', 'Выберите материал!', Ext.MessageBox.WARNING);
        return;
    }
    wwin.hide();
    Ext.Ajax.request({
        url: (Ext.getCmp('typecmb').getValue() == 'theme') ? window.link_getTheme : window.link_getCourse,
        params: {
            id: selectedId
        },
        success: function (response) {
            var eduObject = JSON.parse(response.responseText);
            //adjacency matrix for algorithm of cycles searching 
            var adjacencyMatrix = new Array(eduObject.childs.length);

            //create blocks
            var bodyText = '<div class="demo container" id="container">\n';
            for (var i = 0; i < eduObject.childs.length; i++) {
                var currentEO = eduObject.childs[i];
                var coordinates = currentEO.coordinates[0];
                var currentName = (currentEO.name.length < 40) ? currentEO.name : currentEO.name.substring(0, 40) + '...';
                
                bodyText += '<div style="position: absolute; top: ' + ((coordinates == null) ? (parseInt(i / 5)) * 100 + 20 : coordinates.y) + 'px; left: ' + ((coordinates == null) ? (i % 5) * 200 : coordinates.x) + 'px" ' +
                    'class="window" id="' + currentEO.id + '"><strong>' + currentName + '</strong><br/><br/></div>\n';

                adjacencyMatrix[currentEO.id] = new Array();
            }
            bodyText += '</div>';

            //toolbar
            var body = new Ext.panel.Panel({
                html: bodyText
            });
            var tlbar = new Ext.toolbar.Toolbar({
                items: [{
                        text: 'Сохранить',
                        iconCls: 'save',
                        handler: function () { saveCourse(); }
                    }, {
                        text: 'Помощь',
                        iconCls: 'help',
                        handler: function () {
                            createAndShowNewReportWindow('Помощь', 'Для соединения двух объектов нажмите на любой из коннекторов исходного элемента и проведите линию до любого коннектора связанного элемента.<br><br>' +
                                'Для удаления связи нажмите левой кнопкой мыши на связь и подтвердите удаление.<br><br>' +
                                'Чтобы сохранить изменения, нажмите кнопку "Сохранить" на тулбаре.', Ext.MessageBox.INFO);
                        }
                    }]
            });

            var editor = new Ext.Panel({
                title: eduObject.name,
                layout: 'auto',
                dockedItems: [tlbar],
                items: [body]
            });

            renderToMainArea(editor);

            //jsPlumb init
            var sourceAnchors = [[0.2, 0, 0, -1, 0, 0, "foo"], [1, 0.2, 1, 0, 0, 0, "bar"], [0.8, 1, 0, 1, 0, 0, "baz"], [0, 0.8, -1, 0, 0, 0, "qux"]],
                targetAnchors = [[0.6, 0, 0, -1], [1, 0.6, 1, 0], [0.4, 1, 0, 1], [0, 0.4, -1, 0]],

                exampleColor = '#00f',

                connector = ["Straight", { cssClass: "connectorClass", hoverClass: "connectorHoverClass"}],
                connectorStyle = {
                    gradient: { stops: [[0, exampleColor], [0.5, '#09098e'], [1, exampleColor]] },
                    lineWidth: 5,
                    strokeStyle: exampleColor
                },
                hoverStyle = {
                    strokeStyle: "#449999"
                },
                overlays = [
                    ["Arrow", { fillStyle: "#09098e", width: 15, length: 15, location: 0.3}],
                    ["Arrow", { fillStyle: "#09098e", width: 15, length: 15, location: 0.7}]
                ],
                endpoint = ["Dot", { cssClass: "endpointClass", radius: 10, hoverClass: "endpointHoverClass"}],
                endpointStyle = { fillStyle: exampleColor },
                anEndpoint = {
                    endpoint: endpoint,
                    paintStyle: endpointStyle,
                    hoverPaintStyle: { fillStyle: "#449999" },
                    isSource: true,
                    isTarget: true,
                    maxConnections: -1,
                    connector: connector,
                    connectorStyle: connectorStyle,
                    connectorHoverStyle: hoverStyle,
                    connectorOverlays: overlays
                };

            instance = jsPlumb.getInstance({
                DragOptions: { cursor: 'pointer', zIndex: 2000 },
                Container: "container"
            });

            // suspend drawing and initialise.
            instance.doWhileSuspended(function () {
                var endpoints = {},
                // ask jsPlumb for a selector for the window class
                divsWithWindowClass = jsPlumb.getSelector(".container .window");

                // add endpoints to all of these - one for source, and one for target, configured so they don't sit
                // on top of each other.
                for (var i = 0; i < divsWithWindowClass.length; i++) {
                        var id = instance.getId(divsWithWindowClass[i]);
                    endpoints[id] = [
                        instance.addEndpoint(id, anEndpoint, { anchor: sourceAnchors }),
                        instance.addEndpoint(id, anEndpoint, { anchor: targetAnchors })
                    ];
                }
                // connect blocks
                for (var i = 0; i < eduObject.childs.length; i++) {
                    var outputLinkesArray = eduObject.childs[i].outputLinks;
                    for (var j = 0; j < outputLinkesArray.length; j++) {
                        instance.connect({
                            source: endpoints[outputLinkesArray[j].parentId][0],
                            target: endpoints[outputLinkesArray[j].linkedId][1]
                        });
                        adjacencyMatrix[outputLinkesArray[j].parentId][outputLinkesArray[j].linkedId] = 1;
                    }
                }

                // bind click listener; delete connections on click			
                instance.bind("click", function (conn) {
                    if (!isAutoConnectionDelete) {
                        adjacencyMatrix[conn.sourceId][conn.targetId] = undefined;
                    } 
                    instance.detach(conn);
                });

                // bind beforeDetach interceptor: will be fired when the click handler above calls detach, and the user
                // will be prompted to confirm deletion.
                instance.bind("beforeDetach", function (conn) {
                    if (!isAutoConnectionDelete) {
                        return confirm("Вы уверены, что хотите удалить связь?");
                    }
                });

                //check for same block connection, duplicate connection and cycles 
                instance.bind("connection", function (info, originalEvent) {
                    if (isNeedDeleteConnection(info.connection)) {
                        isAutoConnectionDelete = true;   
                        instance.detach(info.connection);
                        isAutoConnectionDelete = false;
                    }
                });

                instance.draggable(divsWithWindowClass);

                var isNeedDeleteConnection = function (connection) {
                    if (connection.targetId == connection.sourceId || adjacencyMatrix[connection.sourceId][connection.targetId] == 1) {
                        return true;
                    }

                    if (adjacencyMatrix[connection.targetId][connection.sourceId] == 1) {
                        createAndShowNewReportWindow('Нельзя соединить элементы', 'Нельзя соединить элементы, так как они уже соединены в другом направлении!', Ext.MessageBox.WARNING);
                        return true;
                    }

                    adjacencyMatrix[connection.sourceId][connection.targetId] = 1;
                    var hasCycles = function (matrix, currentElement, startElement) {
                        for (var i = 0; i < eduObject.childs.length; i++) {
                            var currentId = eduObject.childs[i].id;
                            if (matrix[currentElement][currentId] == 1) {
                                if (currentId == startElement) {
                                    return true;
                                }
                                if (hasCycles(matrix, currentId, startElement)) {
                                    return true;
                                }
                            };          
                        }
                        return false;
                    };

                    if (hasCycles(adjacencyMatrix, connection.sourceId, connection.sourceId)) {
                        createAndShowNewReportWindow('Нельзя соединить элементы', 'Нельзя соединить элементы, так как образуется цикл!', Ext.MessageBox.WARNING);
                        adjacencyMatrix[connection.sourceId][connection.targetId] = undefined;
                        return true;
                    };
                    return false;
                };

                
            });
        }
    });
};


var themeSelect = new Ext.form.field.ComboBox({
    id: 'themecmb',
    xtype: 'combobox',
    fieldLabel: 'Выберите тему',
    store: themeStore,
    displayField: 'name',
    valueField: 'id',
    labelWidth: 150,
    msgTarget: 'side'
});

var selectPanel = new Ext.FormPanel({
    frame: true,
    defaultType: 'textfield',
    monitorValid: true,

    fieldDefaults: {
        labelWidth: 150,
        msgTarget: 'side'
    },
    items: [{
        id: 'typecmb',
        xtype: 'combobox',
        fieldLabel: 'Выберите тип материала',
        store: typeStore,
        displayField: 'name',
        valueField: 'id',
        listeners: {
            'select': function () {
                if (Ext.getCmp('typecmb').getValue() == 'theme') {
                    selectPanel.items.add(themeSelect);
                }
                else if (Ext.getCmp('typecmb').getValue() == 'course') {
                    selectPanel.items.remove(themeSelect);
                }
                selectPanel.update();
            }
        }
    },{
        id: 'coursecmb',
        xtype: 'combobox',
        fieldLabel: 'Выберите курс',
        store: courseStore,
        displayField: 'name',
        valueField: 'id',
        listeners: {
            'select': function() {
                themeStore.proxy.extraParams.courseId = Ext.getCmp('coursecmb').getValue();
                themeStore.reload();
                if (Ext.getCmp('themecmb') != null) {
                    Ext.getCmp('themecmb').setValue("");
                }
            }
        }
    }],
    buttons: [{
        text: 'Открыть',
        formBind: false,
        // Function that fires when user clicks the button 
        handler: initEditor
    }]
});

Ext.onReady(function () {
    //Default type value (course)
    Ext.getCmp('typecmb').setValue(typeStore.getAt('0').get('id'));
    wwin.show();
});


// This just creates a window to wrap the login form. 
// The login object is passed to the items collection.       
var wwin = new Ext.Window({
    layout: 'fit',
    width: 350,
    height: 150,
    closable: false,

    plain: true,
    border: false,
    title: 'Выбор материала',
    items: [selectPanel],
    modal: true
});

var saveCourse = function () {
    var eduObjects = instance.getSelector(".container .window");
    var coordinatesForSend = [eduObjects.length];
    if (coordinatesForSend[0] == 0) {
        coordinatesForSend = null;
    }

    for (var i = 0; i < eduObjects.length; i++) {
        var eduObject = new Object();
        eduObject.id = eduObjects[i].attributes.Id.value;
        eduObject.x = $('#' + eduObject.id).position().left;
        eduObject.y = $('#' + eduObject.id).position().top;
        coordinatesForSend[i] = eduObject;
    }

    var connections = instance.getAllConnections();
    var connctionsForSend = [connections.length];
    if (connctionsForSend[0] == 0) {
        connctionsForSend = null;
    }

    for (var i = 0; i < connections.length; i++) {
        var conn = new Object();
        conn.parentLink = connections[i].sourceId;
        conn.linkedLink = connections[i].targetId;
        connctionsForSend[i] = conn;
    }

    Ext.Ajax.request({
        url: (Ext.getCmp('typecmb').getValue() == 'theme') ? window.link_saveTheme : window.link_saveCourse,
        method: 'POST',
        params: {
            connections: JSON.stringify(connctionsForSend),
            coordinates: JSON.stringify(coordinatesForSend),
            id: (Ext.getCmp('typecmb').getValue() == 'theme')? Ext.getCmp('themecmb').getValue() : Ext.getCmp('coursecmb').getValue()
        },
        success: function () {
            createAndShowNewReportWindow('Отчёт о сохранении', 'Связи успешно сохранены!', Ext.MessageBox.INFO);
        },
        failure: function () {
            createAndShowNewReportWindow('Отчёт о сохранении', 'Ошибка при сохранении связей!', Ext.MessageBox.ERROR);
        }
    });
};

var createAndShowNewReportWindow = function (title, msg, icon, buttons) {
    Ext.MessageBox.show({
        title: title,
        msg: msg,
        icon: icon,
        closable: true,
        buttons: Ext.MessageBox.OK
    });
};
