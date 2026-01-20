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
                <button class="unreadButton" onclick="markAsUnread(event, ` + chats[x]._id.trim() + `)">Mark as unread</button>
                <button class="leaveButton" onclick="leaveButton(event, ` + chats[x]._id.trim() + `)">Leave chat</button>
                <button class="deleteButton" onclick="deleteChat(event, ` + chats[x]._id.trim() + `)">Delete chat</button>
            </div>
        </div>
    `);

}

function deleteChat (e, id) {

    e.stopPropagation();

    console.log("Deleting chat");

    fetch('/deleteChat/' + id, {method: 'POST'}, function (err, response) {
        console.log(response);
    });

}

function markAsUnread (e, id) {
  
    e.stopPropagation();

    fetch('/markChatAsUnread/' + id, {method: 'POST'}, function (err, response) {
        console.log(response);
    });

}

function leaveChat (e, id) {

    e.stopPropagation();
    
    fetch('/leaveChat/' + id, {method: 'POST'}, function (err, response) {
        console.log(response);
    });

}

function expandButton (doc) {

    if (doc.parentElement.querySelector('.expandedButton').style.display == 'flex') {
        doc.parentElement.querySelector('.expandedButton').style.setProperty('display', 'none', 'important');
    } else {
        doc.parentElement.querySelector('.expandedButton').style.setProperty('display', 'flex', 'important');
    }

}


function enterChat (id) {

    console.log("Entering chat");

    chatSendContainer.innerHTML = `
        <div id="sendMessageBar">
            <input type="text" placeholder="Send a message to ` + id + `" id="sendMessageInput">
            <button type="submit" id="submitMessage"><img src="/send.svg" id="sendMessageIcon"></button>
        </div>
    `;

    fetch('/chat/' + id, function (err, response) {
        console.log(response);
    });

}

messageSend.addEventListener('submit', function (evt) {

    evt.preventDefault();

    messageInput.value = "";

    console.log("Submitted");

});

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

const fillBox = document.querySelector('#userNameInput');

fillBox.addEventListener('keydown', function(e){
    if (e.key === 'Tab'){
        e.preventDefault();
    }
});

fillBox.addEventListener('keyup', async function(event){
    const backg = document.querySelector('#ghostText');
    let currInput = fillBox.value;

    if (fillBox.value == ""){
        backg.textContent = "";
    } else {

        const names = getNames().then( names => {
                let updatedArr = names.filter(name => name.toLowerCase().startsWith(currInput.toLowerCase()));
                if (event.key === 'Tab'){
                    fillBox.value = updatedArr[0];
                } else {
                    backg.textContent = currInput + updatedArr[0].slice(currInput.length);
                }
            }
        );
    }
});

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
