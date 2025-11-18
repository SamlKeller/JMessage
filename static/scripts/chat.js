console.log("Loaded chat.js");

console.log(chats);

const chatInsert = document.getElementById('chatInsert');

for (let x = 0; x < chats.length; x++) {

    chatInsert.insertAdjacentHTML('afterbegin', `
        <p>Chat ` + chats[x].name + `</p>
    `);

}

//Dark Mode Icon onclick

function turnDark(){
    document.body.style.background = '#242424';
    const elements = document.querySelectorAll('.backgroundSections'); 
    Array.from(elements).forEach(element => {
        element.style.background = '#363636';
    });
}
