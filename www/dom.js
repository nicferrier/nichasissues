function mkel(name, parent) {
    if (parent !== undefined) {
        return parent.appendChild(document.createElement(name));
    }
    else {
        return document.createElement(name);
    }
}


export {mkel};
