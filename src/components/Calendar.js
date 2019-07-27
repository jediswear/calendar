const moment = require('moment')

const FORMAT = 'DD.MM.YYYY'
const DAYS_IN_WEEK = 7

class DropDown {
    constructor(selector) {
        this.item = selector
        this.current = this.item.querySelector('.curr-value')
        this.drop = this.item.querySelector('.filter-list')
        this.list = this.drop.querySelectorAll('li')
        this.changeCallback = () => {
        }
        this.init()
    }

    init() {
        this.current.addEventListener('click', () => this.toggle())

        this.list.forEach(list => {
            list.addEventListener('click', (e) => {

                this.close()
                this.changeCurrentValue(e)
                this.changeCallback(e)
            })
        })
    }

    changeCurrentValue(e) {
        this.current.querySelector('.curr-value-text').innerHTML = e.target.textContent
    }

    toggle() {
        this.drop.classList.toggle('active')
    }

    close() {
        this.drop.classList.remove('active')
    }
}

//sort and group courses by periods
class CoursesFilter {
    constructor(courses) {
        this.courses = courses
    }

    prepare() {
        this.courses.forEach((course, i) => {

            /*add colors*/
            course.color = this.setColor(course.type)

            /*calc full length of timelines*/
            this.calcFullLength(course)
        })


        /*group periods if cross*/
        this.courses = this.groupCrossCourses(this.courses)

        /*divide cross period on types: overlay and contains*/
        return this.courses = this.combine(this.courses)
    }

    calcFullLength(course) {
        const { start, end } = course

        course.fullLength = difference(start, end) + 1
    }

    combine(crossGroups) {
        return crossGroups
            .map(group => this.combineGroup(group))
            .reduce((acc, group) => [...acc, ...group], [])
            .reduce((acc, group) => [...acc, ...group], [])
    }

    combineGroup(group) {

        const res = group.reduce((acc, course) => {
            if ( group.length === 1 )
                return [...acc, [course]]

            const block         = [],
                  filteredGroup = unique(group, course).filter(el => !hasElem(acc, el)),
                  coveredElem   = filteredGroup.find(elem => this.crossType(elem, course) === 'overlay' || this.crossType(elem, course) === 'contains')

            const hasCovered = hasElem(acc, coveredElem),
                  hasCourse  = hasElem(acc, course)

            !hasCourse && block.push(course)
            coveredElem && !hasCovered && block.push(coveredElem)


            if ( block.length >= 1 )
                return [...acc, block]
            else
                return acc

        }, [])

        res.forEach(items => {
            this.setPosX(items)
            this.setPosY(items)
            this.setCoverType(group)
            this.setCoverBy(items)
            this.calcMinLength(items)
        })

        return res
    }

    crossType(period_1, period_2) {

        const { start: start_1, end: end_1 } = period_1,
              { start: start_2, end: end_2 } = period_2

        /**
         * check period overlay or contain
         * */
        const res = (difference(start_2, start_1) > 0 && difference(end_2, end_1) > 0)
        ||
        (difference(start_2, start_1) < 0 && difference(end_2, end_1) < 0) ? 'overlay' : 'contains'

        return res
    }

    calcMinLength(courses) {

        if ( courses.length < 2 ) {
            courses.forEach(el => el.currLength = el.fullLength)
            return
        }

        courses.forEach((course, i, arr) => {

            const next = arr[i + 1]

            if ( !next ) return

            course.minLength = difference(course.start, next.start)

            next.minLength = next.overlay ? difference(course.end, next.end) : 0
            next.currLength = next.overlay ? difference(course.end, next.end) : 0
        })
    }

    setCoverBy(group) {

        group.forEach((course, i, arr) => {

            const cover = i === 0 ? arr[1] : arr[0]

            cover && (course.coverBy = cover.id)
        })
    }

    setPosX(group) {
        group.forEach((course, i) => course.posX = i === 0 ? 'start' : 'end')
    }

    setPosY(group) {
        switch ( group.length ) {
            case 2:
                group.forEach(course => course.posY = 'first')
                break
            case 1:
                group.forEach(course => course.coverBy ? course.posY = 'first' : course.posY = 'second')
                break
        }
    }

    setCoverType(group) {
        if ( group.length === 1 ) return

        const first  = group[0],
              second = group[1]

        const type = this.crossType(first, second)

        group.forEach(course => course[type] = true)
    }

    groupCrossCourses(courses) {
        const res = courses.map((course_1) => {

            return courses
                .filter((course_2) => this.isCrossPeriods(course_1, course_2))
                .sort((el1, el2) => difference(el2.start, el1.start))
        })

        return removeDuplicates(res)
    }

    setColor(type) {
        const colors = {
            course: '#ED5454',
            masterClass: '#4BBCC1',
            training: '#9B2997',
            seminar: '#346FF1',
            webinar: '#FD9B5B',
        }

        return colors[type]
    }

    isCrossPeriods(period_1, period_2) {
        const { start: start_1, end: end_1 } = period_1
        const { start: start_2, end: end_2 } = period_2

        if ( difference(start_1, end_2) >= 0 && difference(end_1, start_2) <= 0 ) {
            return true
        }

        return false
    }
}

//slice course to chunks
class CourseSlicer {
    constructor(course) {
        this.course = course
        this.id = this.course.id
        this.start = this.course.start
        this.end = this.course.end
        this.color = this.course.color
        this.type = this.course.type
        this.name = this.course.name

        this.chunks = this.course.chunks

        this.minLength = this.course.minLength
        this.currLength = this.course.currLength
        this.fullLength = this.course.fullLength

        this.posX = this.course.posX
        this.posY = this.course.posY
        this.overlay = this.course.overlay
        this.coverBy = this.course.coverBy
    }

    chunk() {
        this.chunks = this.splitPeriod(this.start, this.end)
            .map(period => ({
                period,
                elem: this.createTimelineElem()
            }))
    }

    cutPeriod(length) {
        const reducedEnd = mom(this.start).add(length - 1, 'days').format(FORMAT),
              endDate    = length ? reducedEnd : this.end


        this.chunks.forEach((period) => period.width = 0)

        const reducedPeriod = this.splitPeriod(this.start, endDate)

        this.setLength(reducedPeriod)
    }

    cutPeriodReverse(length) {

        const reducedStart = mom(this.end).subtract(length - 1, 'days').format(FORMAT),
              startDate    = length ? reducedStart : this.end


        this.chunks.forEach((period) => period.width = 0)

        const reducedPeriod = this.splitPeriod(length === 0 ? mom(startDate).add(1, 'days') : startDate, this.end)

        const difference = this.chunks.length - reducedPeriod.length

        // refactor this
        for ( let i = 0; i < difference; i++ ) {
            reducedPeriod.unshift(null)
        }

        this.setLength(reducedPeriod)
    }

    setLength(chunkedPeriod) {

        chunkedPeriod
            .forEach((el, i) => {

                if ( el === null ) {
                    this.chunks[i].width = 0
                    return
                }

                const { start, end } = el
                const width = difference(start, end) + 1

                this.chunks[i].width = width
            })
    }

    splitPeriod(start, end) {

        const newChunks    = [],
              chunksAmount = this.getChunksAmount(start, end)

        if ( chunksAmount === 1 ) {

            const chunk = { start, end }
            newChunks.push(chunk)

        } else {

            for ( let iteration = 0; iteration < chunksAmount; iteration++ ) {

                const chunk = {}

                if ( iteration === 0 ) {
                    chunk.start = start
                    chunk.end = datePosInWeek('endOf', start).format(FORMAT)
                } else if ( iteration === chunksAmount - 1 ) {
                    chunk.start = datePosInWeek('startOf', end).format(FORMAT)
                    chunk.end = end
                } else {
                    chunk.start = datePosInWeek('startOf', start).add(iteration, 'weeks').format(FORMAT)
                    chunk.end = datePosInWeek('endOf', start).add(iteration, 'weeks').format(FORMAT)
                }

                newChunks.push(chunk)
            }
        }

        return newChunks
    }

    getChunksAmount(start, end) {
        const momentStart  = mom(start).startOf('isoWeek'),
              momentEnd    = mom(end).endOf('isoWeek'),
              daysInRow    = difference(momentStart, momentEnd),
              chunksAmount = (daysInRow + 1) / DAYS_IN_WEEK

        return chunksAmount
    }

    createTimelineElem() {
        const elem = document.createElement('div'),
              dots = this.posY === 'first' ? this.createDotsElem() : '',
              name = this.createNameElem()

        elem.dataset.id = this.id
        elem.classList.add(this.posX)
        elem.innerHTML = this.posX === 'start' ? `${name}${dots}` : `${dots}${name}`

        return elem
    }

    createDotsElem() {
        return `<span class="dots">
                    <span class="dot" style="background-color: ${this.color}"></span>
                    <span class="dot" style="background-color: ${this.color}"></span>
                    <span class="dot" style="background-color: ${this.color}"></span>
                </span>`
    }

    createNameElem() {
        return `<span class="name" style="background: ${this.color}">
                    <span class="begin-mark"></span>
                    ${this.name} 
                </span>`
    }
}

//display courses
class Calendar {
    constructor(calendar) {
        this.calendar = calendar
        this.prev = this.calendar.querySelector('.prev')
        this.next = this.calendar.querySelector('.next')
        this.title = this.calendar.querySelector('.calendar-head .content .title')
        this.subtitle = this.calendar.querySelector('.calendar-head .content .subtitle')
        this.dates = [...this.calendar.querySelectorAll('.date')]
        this.dataDates = []
        this.width = this.calendar.offsetWidth
        this.onePersentWidth = this.width / 100
        this.courses = [
            {
                id: '1',
                name: 'Компакт курс з МСФ3',
                start: '01.05.2019',
                end: '07.05.2019',
                type: 'webinar'
            },
            {
                id: '2',
                name: 'Компакт курс з МСФ3',
                start: '03.05.2019',
                end: '08.05.2019',
                type: 'course'
            },
            {
                id: '3',
                name: 'Компакт курс з МСФ3',
                start: '07.05.2019',
                end: '13.05.2019',
                type: 'training'
            },
            {
                id: '4',
                name: 'Компакт курс з МСФ3',
                start: '15.05.2019',
                end: '19.05.2019',
                type: 'seminar'
            },
            {
                id: '5',
                name: 'Компакт курс з МСФ3',
                start: '21.05.2019',
                end: '26.06.2019',
                type: 'course'
            },
            {
                id: '6',
                name: 'Компакт курс з МСФ3',
                start: '24.05.2019',
                end: '03.06.2019',
                type: 'masterClass'
            },
            {
                id: '7',
                name: 'Компакт курс з МСФ3',
                start: '22.05.2019',
                end: '12.06.2019',
                type: 'training'
            },
            {
                id: '8',
                name: 'Компакт курс з МСФ3',
                start: '14.05.2019',
                end: '16.05.2019',
                type: 'masterClass'
            }
        ]
        this.filteredCourses = [...this.courses]
        this.month = moment().subtract(2, 'month')
        this.monthNames = [
            'Січень',
            'Лютий',
            'Березень',
            'Квітень',
            'Травень',
            'Червень',
            'Липень',
            'Серпень',
            'Вересень',
            'Жовтень',
            'Листопад',
            'Грудень',
        ]
    }

    buildCalendar() {
        this.monthHandler(this.month)

        this.prev.addEventListener('click', () => this.monthHandler(this.month, 'subtract'))
        this.next.addEventListener('click', () => this.monthHandler(this.month, 'add'))

        const filters = this.calendar.querySelectorAll('.filter')
        filters.forEach(filter => {
            const newFilter = new DropDown(filter)

            newFilter.changeCallback = (e) => {
                const type = e.target.dataset.type

                this.filteredCourses = type === 'all' ? [...this.courses] : this.courses.filter(el => el.type === type)

                this.monthHandler(this.month)
            }

        })
    }

    monthHandler(currMonth, method) {
        this.month = method ? mom(currMonth)[method](1, 'month') : currMonth

        const mIndex = this.month.month()

        this.title.innerHTML = this.monthNames[mIndex]
        this.subtitle.innerHTML = this.month.year()

        this.render(this.month)
    }

    render(month) {
        const desktop = window.innerWidth >= 768 ? true : false

        this.renderDays(month)

        const courses        = new CoursesFilter(this.filteredCourses),
              groupedCourses = courses.prepare(),
              newCourses     = groupedCourses.map(period => new CourseSlicer(period))

        desktop ? this.renderDesktop(newCourses) : this.renderMob(newCourses)
    }

    renderMob(courses) {
        courses.forEach(course => this.renderMobCourse(course))
    }

    renderMobCourse(course) {
        const days = this.periodToDates(course)

        this.dates.forEach(date => {
            const exist = days.find(day => day === date.dataset.date)

            if ( exist ) {
                const dot = this.createBigDotElem(course)
                dot.classList.add('active')
                date.appendChild(dot)
                console.log(dot);
            }
        })
    }

    periodToDates(course) {
        const { start, end } = course,
              diff           = difference(start, end) + 1,
              res            = []

        for ( let i = 0; i < diff; i++ ) {
            const date = mom(start).add(i, 'days').format(FORMAT)
            res.push(date)
        }

        return res
    }

    renderDesktop(courses) {
        this.pasteAllRows(courses)
        this.findCrossPlaces(courses)
        this.defaultRender(courses)

        courses.forEach(currCourse => {

            currCourse.chunks.forEach((period) => {

                const navDots = period.elem.querySelector('.dots')

                navDots && navDots.addEventListener('click', () => this.navDotsHandler(courses, currCourse))
            })
        })
        this.addBigDotsHandlers()
    }

    navDotsHandler(newCourses, course) {
        const overlayInstance = newCourses.find(currCourse => currCourse.course.id === course.course.coverBy)
        overlayInstance && this.changeLength(overlayInstance)

        this.changeLength(course)
        this.toggleBigDots(course)
    }

    toggleBigDots(course) {
        if ( course.coverBy ) {
            const bigDots = [...this.calendar.querySelectorAll('.big-dot')]
            bigDots
                .filter(el => el.dataset.id === course.coverBy || el.dataset.id === course.id)
                .forEach(el => el.classList.remove('active'))

            bigDots
                .filter(el => el.dataset.id === course.coverBy)
                .forEach(el => el.classList.add('active'))
        }
    }

    addBigDotsHandlers() {
        const bigDots = [...this.calendar.querySelectorAll('.big-dot')]

        bigDots.forEach(item => item.addEventListener('click', e => this.bigDotsHandler(e)))
    }

    bigDotsHandler(e) {
        const dotId          = e.target.dataset.id,
              timelines      = [...this.calendar.querySelectorAll('.start, .end')],
              targetTimeline = timelines.filter(timeline => timeline.dataset.id === dotId)[0]

        targetTimeline.querySelector('.dots').click()
    }

    changeLength(course) {

        const {
                  minLength,
                  fullLength,
                  currLength,
                  posX,
                  chunks
              }      = course,
              length = currLength === minLength ? fullLength : minLength

        if ( posX === 'start' ) course.cutPeriod(length)
        else
            course.cutPeriodReverse(length)

        course.currLength = length

        this.toggleNavDots(course)
        this.setWidth(chunks)
    }

    defaultRender(rows) {
        rows.forEach(inst => {

            inst.cutPeriod()

            setTimeout(() => {
                this.setWidth(inst.chunks)
                this.calendar.querySelectorAll('.start .dots').forEach(el => el.click())
            })
        })
    }

    toggleNavDots(course) {

        //refactor this

        if ( course.posX === 'start' ) {
            const elemForDots = course.chunks[0].elem

            if ( course.minLength === course.currLength ) {
                elemForDots.classList.add('showDots')
            } else {
                elemForDots.classList.remove('showDots')
            }
        } else {
            const elemForDots = course.chunks[course.chunks.length - 1].elem

            if ( course.minLength === course.currLength ) {
                elemForDots.classList.add('showDots')
            } else {
                elemForDots.classList.remove('showDots')
            }
        }


    }

    pasteAllRows(courses) {
        courses.forEach(course => {

            course.chunk()
            course.chunks.forEach((chunk) => {
                this.chunkOnTimeline(chunk, course.posY, course.posX)
            })
        })
    }

    findCrossPlaces(courses) {

        const tempCourses = [...courses]

        const resPeriod = tempCourses
            .reduce((acc, course, x) => {
                const covered = tempCourses.find((el) => course.id === el.coverBy)

                if ( covered ) {

                    const direction = difference(course.start, covered.start) > 0,
                          type      = course.overlay === true

                    const crossPer1 = {
                        id: course.id,
                        color: direction && type ? course.color : covered.color,
                        start: direction && type ? covered.start : course.start,
                        end: direction && type ? course.end : covered.end
                    }

                    const crossPer2 = {
                        id: covered.id,
                        color: direction && type ? covered.color : course.color,
                        start: direction && type ? covered.start : course.start,
                        end: direction && type ? course.end : covered.end
                    }

                    tempCourses.splice(x, 1)
                    return [...acc, [crossPer1, crossPer2]]
                } else
                    return acc
            }, [])

        resPeriod.forEach(period => {
            period.forEach(el => this.setBigDots(el))
        })
    }

    setBigDots(period) {

        this.dates.forEach(date => {
            const dateStart = date.dataset.date
            const bigDot = this.createBigDotElem(period)

            if ( mom(period.start).diff(mom(dateStart)) <= 0 && mom(period.end).diff(mom(dateStart)) >= 0 ) {
                date.appendChild(bigDot)
            }

        })
    }

    createBigDotElem(course) {
        const bigDot = document.createElement('span')
        bigDot.classList.add('big-dot')
        bigDot.style.background = course.color
        bigDot.dataset.id = course.id


        return bigDot
    }

    chunkOnTimeline(chunk, posY, posX) {

        const { period: { start, end }, elem } = chunk

        this.dates
            .forEach((dateElem) => {

                const { date } = dateElem.dataset

                const placeForStart = posX === 'start' && start === date,
                      placeForEnd   = posX === 'end' && end === date

                if ( placeForStart || placeForEnd ) {

                    posY !== 'first' && elem.classList.add('secondLine')
                    dateElem.appendChild(elem)
                }
            })
    }

    setWidth(chunks) {

        chunks.forEach(({ elem, width }) => {

            const pxWidth = this.percentToPx(100 / DAYS_IN_WEEK * width)

            elem.style.width = `${pxWidth >= 0 ? pxWidth : 0}px`
        })
    }

    renderDays(currentMonth) {
        const prevMonth         = moment(currentMonth).subtract(1, 'month'),
              nextMonth         = moment(currentMonth).add(1, 'month'),
              currentStartIndex = currentMonth.date(1).format('E') - 1

        const prevDays    = getArrayOfDates(prevMonth),
              currentDays = getArrayOfDates(currentMonth),
              nextDays    = getArrayOfDates(nextMonth)

        prevDays.splice(0, prevDays.length - currentStartIndex)
        nextDays.splice(35 - (prevDays.length + currentDays.length))

        this.dataDates = [...prevDays, ...currentDays, ...nextDays]

        this.dates.forEach((date, i) => {

            if ( i < prevDays.length || i >= prevDays.length + currentDays.length )
                date.classList.add('other-month')
            else date.classList.remove('other-month')

            date.dataset.date = this.dataDates[i]
            date.innerHTML = `<span class="date-label">${moment(this.dataDates[i], FORMAT).format('D')}</span>`
        })
    }

    percentToPx(percent) {
        return percent * this.onePersentWidth - 1
    }
}



function mom(date) {
    return moment(date, FORMAT)
}

function difference(start, end) {
    return mom(end).diff(mom(start), 'days')
}

function getArrayOfDates(month) {
    const total = month.daysInMonth(),
          days  = []

    for ( let i = 1; i <= total; i++ ) days.push(month.date(i).format(FORMAT))

    return days
}

function datePosInWeek(pos, date) {
    return mom(date)[pos]('isoWeek')
}

function removeDuplicates(arr) {
    const uniq = [...new Set(arr.map(el => JSON.stringify(el)))]

    return uniq.map(el => JSON.parse(el))
}

function hasElem(arr, elem) {
    const res = arr.reduce((acc, el) => [...acc, ...el], [])
    return res.find(el => el === elem)
}

function unique(arr, elem) {
    return arr.filter(el => el !== elem)
}

export default Calendar