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
            <button class="optionsButton" onclick="expandButton(this)">
                <img src="/messageOptions.svg" class="messageOptionsIcon">
            </button>
            <div class="expandedButton">
                <button class="unreadButton" onclick="markAsUnread(` + chats[x]._id.trim() + `)">Mark as unread</button>
                <button class="leaveButton" onclick="leaveButton(` + chats[x]._id.trim() + `)">Leave chat</button>
                <button class="deleteButton" onclick="deleteChat(` + chats[x]._id.trim() + `)">Delete chat</button>
            </div>
        </div>
    `);

}

function expandButton (doc) {

    if (doc.parentElement.querySelector('.expandedButton').style.display == 'flex') {
        doc.parentElement.querySelector('.expandedButton').style.setProperty('display', 'none', 'important');
    } else {
        doc.parentElement.querySelector('.expandedButton').style.setProperty('display', 'flex', 'important');
    }

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
