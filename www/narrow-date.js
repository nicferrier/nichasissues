function narrowingDate(time) {
    const getMonthString = function (time) {
        const years = time.getFullYear();
        const months = "" + time.getMonth() + 1;
        return `${years}-${months.padStart(2, "0")}`;
    };
    const getDayString = function (time) {
        const months = "" + time.getMonth() + 1;
        const days = "" + time.getDate();
        return `${months.padStart(2, "0")}-${days.padStart(2, "0")}`;
    };
    const now = new Date();
    const hours = "" + time.getHours();
    const minutes = "" + time.getMinutes();
    const timeString = `${hours.padStart(2, "0")}:${minutes.padStart(2, "0")}`;

    const epoch = time.valueOf();
    const oneDayMs = (1000 * 60 * 60 * 24);
    const oneYearMs = (1000 * 60 * 60 * 24 * 365);
    const timeMs = now.valueOf();
    const longString = (epoch < timeMs - oneYearMs)
          ? getMonthString(time)
          : (epoch < timeMs - oneDayMs)
          ? getDayString(time)
          : timeString;
    return longString;
}

export default narrowingDate;

// end
