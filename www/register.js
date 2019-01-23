window.addEventListener("load", loadEvt => {
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
    document.querySelector("form").addEventListener("submit", async submitEvt => {
        submitEvt.preventDefault();
        submitEvt.stopPropagation();
        const form = new FormData(submitEvt.target);
        const [...pairs] = form.entries();
        const data = new URLSearchParams(pairs);
        const response = await fetch(submitEvt.target.action, {
            method: "POST",
            body: data
        });
        console.log(response);
        return false;
    });
});
