
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
    const response = await fetch(baseUrl + "/issue");
    const jsonData = await response.json();
    const data = JSON.parse(jsonData);
    console.log(data);
    const issueElements = data.map(issue => {
        const {id,d,data: {summary, description, editor}} = issue;
        const issueElement = document.createElement("table");
        const tr = issueElement.appendChild(document.createElement("tr"));
        const tdSummary = tr.appendChild(document.createElement("td"));
        tdSummary.classList.add("summary");
        tdSummary.textContent = summary;
        const tdDescription = tr.appendChild(document.createElement("td"));
        tdDescription.classList.add("description");
        tdDescription.textContent = description;
        return issueElement;
    });
    const top = document.querySelector(".top-issues");
    issueElements.forEach(issue => {
        top.appendChild(issue);
    });
});
