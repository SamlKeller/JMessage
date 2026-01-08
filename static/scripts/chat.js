//console.log("Loaded chat.js");
//console.log(chats);

const chatInsert = document.getElementById('chatInsert');

for (let x = 0; x < chats.length; x++) {

    chatInsert.insertAdjacentHTML('afterbegin', `
        <div class="chatButton" onclick="enterChat('` + chats[x]._id.trim() + `')">
            <div class="leftChatContent">
                <img src="/defaultPicture.svg" class="defaultPic">
                <p class="chatName">` + chats[x].name + `</p>
            </div>
            <button class="optionsButton">
                <img src="/messageOptions.svg" class="messageOptionsIcon">
            </button>
        </div>
    `);

}

function enterChat (id) {

    //console.log("Entering chat");

    currentChat.innerHTML = id;

    fetch('/chat/' + id, function (err, response) {
        //console.log(response);
    });

}

async function getNames () {
    try{ 
        const response = await fetch('/testSearch', {
            method: 'POST' 
        });
        const result = await response.json();
        return result
    } catch (err) {
        console.log(err);
    }
    return 0 
}

async function filterUsers(){
    const names = getNames();

}


populteOptions();

async function populteOptions(){
    const choiceSections = document.querySelector("#userSearchBox");
    let userChoices = await getNames();

    if (userChoices){
        let userCounter = 5;
        userChoices.forEach((user) => { 
            if (userCounter){
                choiceSections.insertAdjacentHTML("afterbegin",`
                    <div class="usersShown">
                        <p class="userNamesDisplay">` + user + `</p>
                    </div>
                `);
            }
            userCounter--; 
        });
    }
}

//Dark Mode Icon onclick

function turnDark () {
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

function turnLight () {
    
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
