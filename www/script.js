function mkel(name, parent) {
    if (parent !== undefined) {
        return parent.appendChild(document.createElement(name));
    }
    else {
        return document.createElement(name);
    }
}

function narrowingDate(time) {
    const getMonthString = function (time) {
        console.log("getMonth");
        const years = time.getFullYear();
        const months = "" + time.getMonth() + 1;
        return `${years}-${months.padStart(2, "0")}`;
    };
    const getDayString = function (time) {
        console.log("getDay");
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

window.addEventListener("load", async loadEvt => {
    console.log(`
 __    _  ___   _______    __   __  _______  _______    ___   _______  _______  __   __  _______  _______ 
|  |  | ||   | |       |  |  | |  ||   _   ||       |  |   | |       ||       ||  | |  ||       ||       |
|   |_| ||   | |       |  |  |_|  ||  |_|  ||  _____|  |   | |  _____||  _____||  | |  ||    ___||  _____|
|       ||   | |       |  |       ||       || |_____   |   | | |_____ | |_____ |  |_|  ||   |___ | |_____ 
|  _    ||   | |      _|  |       ||       ||_____  |  |   | |_____  ||_____  ||       ||    ___||_____  |
| | |   ||   | |     |_   |   _   ||   _   | _____| |  |   |  _____| | _____| ||       ||   |___  _____| |
|_|  |__||___| |_______|  |__| |__||__| |__||_______|  |___| |_______||_______||_______||_______||_______|
`);
    console.log("an issue tracking system without any bells and no whistles at all.");
    const user = "nicferrier";
    document.querySelector("form").addEventListener("submit", async submitEvt => {
        submitEvt.preventDefault();
        submitEvt.stopPropagation();
        const form = new FormData(submitEvt.target);
        form.append("editor", user);
        const [...pairs] = form.entries();
        const data = new URLSearchParams(pairs);
        console.log(data, submitEvt.target.action);
        const response = await fetch(submitEvt.target.action, {
            method: "POST",
            body: data
        });
        console.log(response);
        return false;
    });

    const baseUrl = document.location.href;
    const response = await fetch(baseUrl + "/top");
    const jsonData = await response.json();
    const data = jsonData; // JSON.parse(jsonData);
    console.log(data);
    const issueElements = data.map(issue => {
        const {id,d,last_update,data: {summary, description, editor}} = issue;
        const tr = mkel("tr");
        const tdDate = mkel("td", tr);
        tdDate.classList.add("date");
        const date = narrowingDate(new Date(last_update));
        tdDate.textContent = date;
        const tdSummary = mkel("td", tr);
        tdSummary.classList.add("summary");
        tdSummary.textContent = summary;
        const tdDescription = mkel("td", tr);
        tdDescription.classList.add("description");
        tdDescription.textContent = description;
        return tr;
    });

    const top = document.querySelector(".top-issues");
    const table = mkel("table", top);
    const head = mkel("thead", table);
    const date = mkel("th", head);
    date.classList.add("date");
    date.textContent = "updated";
    const summary = mkel("th", head);
    summary.classList.add("summary");
    summary.textContent = "summary";
    const description = mkel("th", head);
    description.classList.add("description");
    description.textContent = "description";

    issueElements.forEach(issue => {
        table.appendChild(issue);
    });
});
