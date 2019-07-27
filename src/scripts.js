import './styles/styles.scss'
import Calendar from './components/Calendar'

const calendarItem = document.querySelector('.calendar'),
      calendar     = new Calendar(calendarItem)

calendar.buildCalendar()