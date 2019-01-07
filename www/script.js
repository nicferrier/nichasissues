
window.addEventListener("load", loadEvt => {
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
});
