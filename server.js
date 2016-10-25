var net = require('net');

var Room = require('./room.js');
var HashTable = require('./hash_table.js');


var sockets = [];
var users = new HashTable({});
var rooms = new HashTable({});




function isValidString(str){

    return !/[~`!#$%\^&*+=\-\[\]\\';,/{}|\\":<>\?]/g.test(str);
}


function isAlphanumeric(inputtxt)
{
    var letterNumber = /^[0-9a-zA-Z]+$/;
    return (inputtxt.match(letterNumber));

}

function createRoom(sock,roomName)
{
    var room = new Room(roomName,sock);
    if(sock != null)
    {
        room.addUser(sock.name);
        sock.room = room;
        room.owner = sock.name;
        sock.write("Room named "+roomName+" created successfully\n");
    }

    rooms.setItem(roomName,room);

}

function removeRoom(roomName)
{
    var room = rooms.getItem(roomName);
    var targetUsers = room.users;
    //Iterate through all users in room, kick them out, set appropriate data
    for(var i =0; i<targetUsers.length ; i++)
    {
        var userName = targetUsers[i];
        var user = users.getItem(userName);
        room.removeUser(userName);
        user.room = null;
        user.write("**Chat room you're currently in has been deleted, you're automatically ejected from it. You can create your own using /create_room [RoomName] **\n");

    }

    //remove room from our collection
    rooms.removeItem(roomName);

}

function listAllRooms(sock)
{
   if(rooms.length == 0 ) sock.write("*There are no rooms at the time. You can create your own using /create_room [RoomName]*\n");

   rooms.each(function(key, room){

       var str = room.name + "("+room.getUserCount()+")";

       sock.write(str+ "\n");
   });

}



function broadcastMessage(sock,msg,system)
{
    if(sock.room == null)
    {
        sock.write("*You should join a room to chat with other users. type /rooms to see available rooms or /create_room to create your own\n");
        return;
    }

    var targetUsers = sock.room.users;
    var sender = sock.name +":";
    if(system != undefined)
        sender = "*";

    for(var i =0; i<targetUsers.length ; i++)
    {
        var userName = targetUsers[i];
        if(userName != sock.name)
            users.getItem(userName).write(sender + msg+"\n");
    }

}

function acceptConnection(sock)
{

    sock.write('*Welcome to the world of SAURAN\n');

    sock.write('*Login Name?\n');
    sock.name = '';
    sock.room = null;

    sockets.push(sock);

    sock.on('data', function(data)
    {
        // client writes message

        //console.log("DATA = " + data);

        //remove line feed from the data
        data = (data+"");
        data = data.replace(/(\r\n|\n|\r)/gm,"");

        //console.log("SOCKET NAME = "+sock.name);

        //If user have no name then let him choose a name first before he/she proceeds
        if(sock.name == undefined || sock.name == "undefined" || sock.name == null || sock.name == '')
        {
            var isValid = isValidString(data);
            var userExists = users.hasItem(data);

            //Username should be alphanumeric and a valid string which is not already picked by another user
            if(isAlphanumeric(data) && isValid && !userExists)
            {
                //console.log(data);

                sock.name = data;
                users.setItem(data,sock);
            }
            else
            {
                //Try again
                var msg = "*The name you entered is not valid, Try again\n";
                if(userExists)
                    msg = "*Sorry, the name is already taken, Try again\n";

                sock.write(msg);
                return;
            }

            //name choose successfully. say welcome
            sock.write("*Welcome "+ data + "\n");
            return;

        }

        //QUIT
        if (data.startsWith('/quit'))
        {

            //console.log('exit command received: ' + sock.remoteAddress + ':' + sock.remotePort + '\n');

            sock.write("BYE "+sock.name+". Hope to see you soon\n");
            sock.destroy();
            users.removeItem(sock.name);

        }
        //CREATE NEW ROOM
        else if(data.startsWith('/create_room'))
        {
            if(sock.room != null)
            {
                sock.write("*You are already in a room\n");
                return;
            }

            var splitted = data.split(" ");

            if(splitted.length < 2)
            {
                sock.write("*Please specify a name for room e.g. create_room MyHeaven\n");
                return;

            }

            isValid = isValidString(splitted[1]);

            if(!isValid || rooms.hasItem(splitted[1]))
            {
                sock.write("*Seems like the room name you entered is not valid, Try Again... \n");
                return;
            }


            createRoom(sock,splitted[1]);

        }
        //JOIN A ROOM
        else if(data.startsWith('/join'))
        {
            if(sock.room != null)
            {
                sock.write("*You are already in a room, Please leave this room if you want to join another\n");
                return;
            }

            splitted = data.split(" ");

            if(splitted.length < 2)
            {
                sock.write("*Please specify a name for room e.g. /join MyHeaven\n");
                return;
            }

            var roomName = splitted[1];

            isValid = isValidString(roomName);

            if(!isValid || !rooms.hasItem(roomName))
            {
                sock.write("*Seems like the room name you entered is not valid, Try Again... \n");
                return;
            }

            var roomToJoin = rooms.getItem(roomName);
            roomToJoin.addUser(sock.name);
            sock.room = roomToJoin;

            sock.write("Entering Room "+roomName+"\n");
            roomToJoin.listAllUsers(sock);
            broadcastMessage(sock,"New User Joined Chat: "+ sock.name +"\n",true);
        }
        //LIST ALL ROOMS
        else if(data.startsWith('/rooms'))
        {
            listAllRooms(sock);
        }
        //LEAVE
        else if(data.startsWith('/leave'))
        {
            if(sock.room == null)
            {
                sock.write("*You are not in any room right now\n");
                return;
            }

            if(!rooms.hasItem(sock.room.name))
            {
                sock.write("*Something goes wrong. Please exit and try reconnecting to server \n");
                return;
            }

            sock.write("*You've left the room "+ sock.room.name + "\n");
            broadcastMessage(sock,"User has left the chat : "+sock.name + "\n",true);
            sock.room.removeUser(sock.name);
            sock.room = null;

        }
        //DELETE ROOM
        else if(data.startsWith('/delete_room'))
        {
            splitted = data.split(" ");

            //Not enough number of parameters in command
            if(splitted.length < 2)
            {
                sock.write("*Please specify a name for room e.g. /delete_room MyHeaven\n");
                return;
            }
            roomName = splitted[1];

            //Default room can not be deleted by any user
            if(roomName == "Default") {
                sock.write("*You can not delete Default room\n");
                return;
            }

            var roomToDelete = rooms.getItem(roomName);

            //Room doesn't exists. Less likely to happen but who knows.
            if(roomToDelete == undefined)
            {
                sock.write("*There's no such room named "+roomName+"\n");
                return;
            }

            //Not an owner? Ethically not allowed to delete the room
            if(roomToDelete.owner != sock.name)
            {
                sock.write("*Only owner of a chat room can delete the room.\n");
                return;
            }


            //All set, remove the room
            removeRoom(roomName);

        }
        else
        {
            //rooms.each(function(a,b){
            //    console.log("Room --------> Name = "+ a + "UserCount ="+ b.getUserCount() + "\n");
            //});
            //
            //users.each(function(a,b){
            //    console.log("User -------->  Key = "+ a + "Value ="+ b.name + "\n");
            //});

            broadcastMessage(sock, data);
        }

    });

    sock.on('end', function() { // client disconnects
        //console.log('Disconnected\n');
        sock.destroy();
        users.removeItem(sock.name);
    });
}


var svr = net.createServer(acceptConnection);
createRoom(null,"Default");
svr.listen(5000, '0.0.0.0');

//console.log('Chat Server Created');

