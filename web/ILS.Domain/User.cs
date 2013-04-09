﻿using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.ComponentModel.DataAnnotations;

namespace ILS.Domain
{
	public class User : EntityBase
	{
		public string Name { get; set; }
		public string PasswordHash { get; set; }
        public string FirstName { get; set; }
        public string LastName { get; set; }
        public string Email { get; set; }
        public bool IsApproved { get; set; }

        public int EXP { get; set; }
        public bool FacultyStands_Seen { get; set; }
	    public bool StaffStand_Finish { get; set; }
        public int TestsFinished { get; set; }
        
        public virtual ICollection<Role> Roles {get; set;}
        public virtual ICollection<CourseRun> CoursesRuns { get; set; }

        public User()
        {
            Roles = new List<Role>();
            CoursesRuns = new List<CourseRun>();
        }
	}
}