console.log("Loaded chat.js");

console.log("Chat length: " + chats.length);
console.log(chats);

for (let x = 0; x < chats.length; x++) {

    chatInsert.insertAdjacentHTML('afterbegin', `
        <p>Chat ` + chats[x].name + `</p>
    `);

}   