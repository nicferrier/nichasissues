// Show that one can use Promise.reject directly to return an error

function myError() {
    return Promise.reject(new Error("boo!"));
}

async function consume() {
    const [error] = await myError().catch(e => [e]);
    console.log(error);
}

consume().then();

// End
