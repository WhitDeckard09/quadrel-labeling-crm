/** Name pools for fixture generation. Deliberately varied so the roster reads
 *  like a real central-Ohio manufacturing workforce rather than one demographic. */

export const FIRST_NAMES = [
  'Marcus', 'Danielle', 'Elena', 'Trevor', 'Priya', 'Jamal', 'Kaitlyn', 'Andrei',
  'Sofia', 'Brandon', 'Nia', 'Hector', 'Meghan', 'Dmitri', 'Aisha', 'Colton',
  'Rosa', 'Tyler', 'Yolanda', 'Nathan', 'Linh', 'Garrett', 'Camille', 'Omar',
  'Bridget', 'Devon', 'Ingrid', 'Rashad', 'Katarzyna', 'Wesley', 'Amara', 'Luis',
  'Shannon', 'Kwame', 'Delaney', 'Vikram', 'Tessa', 'Julio', 'Renee', 'Bishop',
  'Maya', 'Curtis', 'Svetlana', 'Terrence', 'Holly', 'Anthony', 'Fatima', 'Grant',
  'Mercedes', 'Joel', 'Simone', 'Duane', 'Paloma', 'Keith', 'Adaeze', 'Reed',
  'Corinne', 'Malik', 'Josefina', 'Lucas', 'Tabitha', 'Emmett', 'Ngozi', 'Blake',
] as const

export const LAST_NAMES = [
  'Whitfield', 'Okonkwo', 'Delgado', 'Brennan', 'Nakamura', 'Vasquez', 'Kowalski',
  'Ferreira', 'Adeyemi', 'Hollis', 'Sandoval', 'McPherson', 'Petrov', 'Nguyen',
  'Castellano', 'Boone', 'Lindqvist', 'Bautista', 'Rowe', 'Achebe', 'Kaminski',
  'Trujillo', 'Weatherby', 'Osei', 'Marchetti', 'Copeland', 'Salazar', 'Duncan',
  'Ibrahim', 'Novak', 'Ramsey', 'Gutierrez', 'Falk', 'Broussard', 'Chandra',
  'Winslow', 'Alvarez', 'Kirkpatrick', 'Sowande', 'Beaumont', 'Reyes', 'Halstead',
  'Moreau', 'Tanaka', 'Prescott', 'Dominguez', 'Fitzgerald', 'Abara', 'Lindgren',
  'Carrasco', 'Thibodeaux', 'Mensah', 'Vandenberg', 'Quinones', 'Ashford', 'Pham',
  'Escobar', 'Bellamy', 'Sorensen', 'Ojeda', 'Grimaldi', 'Washburn', 'Diallo',
] as const

/**
 * Optional flags/notes attached to a small share of weeks. Most weeks have none —
 * the point of the field is that when it *is* populated a manager should look.
 */
export const NOTE_POOL = [
  'Requesting PTO the week of the 22nd — already cleared with my supervisor.',
  'Reported a recurring fault on the line 3 web guide. Maintenance has the ticket.',
  'Will need coverage Thursday for a medical appointment.',
  'Heads up that the roll stock from the new supplier is running inconsistent.',
  'Asked about cross-training on the digital press — would like to pursue it.',
  'Short-staffed on nights again this week. Worth a conversation.',
  'The Meridian Pharma order is at risk if the substrate does not land Monday.',
  'Requesting a schedule change to day shift starting next month if possible.',
  'Reported a near-miss at the rewinder. Incident report is filed.',
  'Still waiting on approval for the spare parts order — it is blocking two work orders.',
  'Completed my forklift recertification this week.',
  'Would like to discuss the overtime distribution on the converting cell.',
  'The dock area lighting is out in two bays. Facilities has been notified.',
  'Flagging that we are consistently missing the changeover time target.',
  'Requesting time off for jury duty the first week of next month.',
  'New hire on my crew is picking things up fast — worth noting.',
  'Equipment issue: slitter is making a noise it did not make last month.',
  'I will be out Monday and Tuesday next week, already approved.',
  'Customer complaint on the color match came back to us again. Third time.',
  'Recommend we revisit the reorder point on the clear BOPP — we ran out twice.',
  'Interested in the open Team Lead posting.',
  'Air conditioning in the north bay has been out all week.',
  'Please confirm whether the holiday shutdown is still on the schedule.',
  'Had to leave early Friday for a family situation. Made the hours up Saturday.',
  'The scale at the packing station is reading inconsistently — worth getting checked.',
  'Second week in a row we ran out of 12x12 cartons mid-shift.',
  'Would like to be considered for the compressed air project when it starts.',
  'My badge stopped working at the north entrance on Wednesday.',
  'Asking whether the tuition reimbursement program is still active.',
  'Training on the new inspection sheet still has not been scheduled for my crew.',
  'The temp we had this week was solid — worth keeping in mind for the open role.',
  'Requesting a swap to the Tuesday/Thursday overtime rotation.',
  'Noticed the emergency eyewash station in the ink room is past its inspection date.',
  'Customer artwork keeps arriving in the wrong format — costing us setup time.',
  'I am scheduled for surgery next month and will need about three weeks off.',
  'The parking lot lighting on the east side has been out since the storm.',
] as const

/** Short reasons attached to late submissions, shown in the submission detail. */
export const LATE_REASONS = [
  'Submitted Monday morning — forgot before I left Friday.',
  'Was out sick Friday, filled this in when I got back.',
  'Sorry for the delay, the link was in my spam folder.',
  'Ran over on the Friday shift and did not get to this until the weekend.',
  'Late — I was on the emergency call Thursday night and it slipped.',
] as const
