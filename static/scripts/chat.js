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
    const darkIcon = document.querySelector('#darkModeIcon');
    const lightIcon = document.querySelector('#lightModeIcon');

    document.body.style.background = '#242424';
    const elements = document.querySelectorAll('.backgroundSections'); 
    Array.from(elements).forEach(element => {
        element.style.background = '#363636';
    });

    darkIcon.style.display = 'none';
    lightIcon.style.display = 'flex';
}

function turnLight(){
    const darkIcon = document.querySelector('#darkModeIcon');
    const lightIcon = document.querySelector('#lightModeIcon');

    document.body.style.background = '#cccccc';
    const elements = document.querySelectorAll('.backgroundSections'); 
    Array.from(elements).forEach(element => {
        element.style.background = '#e5e5e5';
    });

    darkIcon.style.display = 'flex';
    lightIcon.style.display = 'none';
}
