import narrowingDate from "./narrow-date.js";
import {mkel} from "./dom.js";

window.addEventListener("load", async loadEvt => {
    console.log(`
 __    _  ___   _______  
|  |  | ||   | |       | 
|   |_| ||   | |       | 
|       ||   | |       | 
|  _    ||   | |      _| 
| | |   ||   | |     |_  
|_|  |__||___| |_______| 
 __   __  _______  _______  
|  | |  ||   _   ||       | 
|  |_|  ||  |_|  ||  _____| 
|       ||       || |_____  
|       ||       ||_____  | 
|   _   ||   _   | _____| | 
|__| |__||__| |__||_______| 
 ___   _______  _______  __   __  _______  _______ 
|   | |       ||       ||  | |  ||       ||       |
|   | |  _____||  _____||  | |  ||    ___||  _____|
|   | | |_____ | |_____ |  |_|  ||   |___ | |_____ 
|   | |_____  ||_____  ||       ||    ___||_____  |
|   |  _____| | _____| ||       ||   |___  _____| |
|___| |_______||_______||_______||_______||_______|
`);
    console.log("an issue tracking system without any bells and no whistles at all.");

    // Now get some data
    const baseUrl = document.location.href;

    // First the context
    const ctxResponse = await fetch(baseUrl + "/context");
    const {authData:{email}} = await ctxResponse.json();
    const userButton = document.querySelector("button#user");
    userButton.textContent = email;
    userButton.addEventListener("click", clickEvt => {
        alert("nothing happens when you click this right now!");
    });
    const user = email;
    
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


    // Now the top issues
    const response = await fetch(baseUrl + "/top");
    const jsonData = await response.json();
    const data = jsonData; // JSON.parse(jsonData);
    console.log(data);

    const issueElements = data.map(issue => {
        const {id, d, last_update, state, data: {
            issueid, summary, description, editor:owner
        }} = issue;

        const tr = mkel("tr");
        tr.id = issueid;

        const tdDate = mkel("td", tr);
        tdDate.classList.add("date");

        const date = narrowingDate(new Date(last_update));
        tdDate.textContent = date;

        const tdOwner = mkel("td", tr);
        tdOwner.classList.add("owner");
        tdOwner.textContent = owner;

        const tdState = mkel("td", tr);
        tdState.classList.add("state");
        tdState.textContent = state;

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

    const owner = mkel("th", head);
    owner.classList.add("owner");
    owner.textContent = "owner";

    const state = mkel("th", head);
    state.classList.add("state");
    state.textContent = "state";

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
