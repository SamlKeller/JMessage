//console.log("Loaded chat.js");

const chatInsert = document.getElementById('chatInsert');

for (let x = 0; x < chats.length; x++) {

    chatInsert.insertAdjacentHTML('afterbegin', `
        <div class="chatButton" onclick="enterChat('`+chats[x].name.trim()+`', '`+ chats[x]._id.trim() +`')">
            <div class="leftChatContent">
                <img src="/defaultPicture.svg" class="defaultPic">
                <p class="chatName">` + chats[x].name + `</p>
            </div>
            <button class="optionsButton" onclick="expandButton(this)">
                <img src="/messageOptions.svg" class="messageOptionsIcon">
            </button>
            <div class="expandedButton">
                <button class="unreadButton" onclick="markAsUnread(event, ` + chats[x]._id.trim() + `)">Mark as unread</button>
                <button class="leaveButton" onclick="leaveChat(event, '` + chats[x]._id.trim() + `')">Leave chat</button>
            </div>
        </div>
    `);

}
enterChat(chats[chats.length - 1].name.trim(), chats[chats.length - 1]._id.trim());

function markAsUnread (e, id) {
  
    e.stopPropagation();

    fetch('/markChatAsUnread/' + id, {method: 'POST'}, function (err, response) {
        console.log(response);
    });

}

function leaveChat (e, chatId) {
    console.log(chatId);
    e.stopPropagation();
    
    fetch('/leaveChat/' + chatId, {
        method: 'POST'
    }).then(res => res.json()).then( data => {
        if (data.status === '200') {
            location.reload();}
    });
}

function expandButton (doc) {

    if (doc.parentElement.querySelector('.expandedButton').style.display == 'flex') {
        doc.parentElement.querySelector('.expandedButton').style.setProperty('display', 'none', 'important');
    } else {
        doc.parentElement.querySelector('.expandedButton').style.setProperty('display', 'flex', 'important');
    }

}

async function enterChat (name, id) {
    topChatName.innerHTML = name;

    chatSendContainer.innerHTML = `
        <form id="sendMessageBar">
            <input type="text" placeholder="Send a message to ` + name + `" id="sendMessageInput" name="msg">
            <button type="submit" id="submitMessage"><img src="/send.svg" id="sendMessageIcon"></button>
        </form>
    `;

    fetch('/getChat/' + id, {
        method: "POST",
        headers: {"Content-Type": "application/json"}
    }).then(res => res.json()).then(data => {

        
        const parsedData = data.messages;
        messageInsert.innerHTML = ""; 
        
        for (let x = 0; x < parsedData.messages.length; x++) {

            if (parsedData.messages[x].sender == user.username) {

                messageInsert.insertAdjacentHTML('beforeend', `
                
                    <div class="myMessage msg">
                        <p class="myMessageName" msgp>` + parsedData.messages[x].sender + `</p>
                        <p class="myMessageP msgp">` + parsedData.messages[x].text + `</p>
                    </div>
                    
                `);

            } else {

                messageInsert.insertAdjacentHTML('beforeend', `
                
                    <div class="theirMessage msg">
                        <p class="theirMessageName" msgp>` + parsedData.messages[x].sender + `</p>
                        <p class="theirMessageP msgp">` + parsedData.messages[x].text + `</p>
                    </div>
                    
                `);

            }

        }

        messageInsert.scrollTop = messageInsert.scrollHeight;

    }).catch(err => console.error(err));


    document.getElementById("sendMessageBar").addEventListener('submit', function (evt) {

        const messageBox = document.getElementById("sendMessageInput");
        evt.preventDefault();

        if (!messageBox.value == ""){

            fetch('/sendMessage/' + id, {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({
                    msg: messageBox.value
                })
            }).then(res => res.json()).then(data => {

                console.log("Sent");

                let messageValue = messageBox.value;
                messageBox.value = ""; 

                messageInsert.insertAdjacentHTML('beforeend', `
            
                    <div class="myMessage msg">
                        <p class="myMessageName" msgp>` + user.username + `</p>
                        <p class="myMessageP msgp">` + messageValue + `</p>
                    </div>
                            
                `);

                messageInsert.scrollTop = messageInsert.scrollHeight;

            }).catch(err => console.error(err));
        }
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