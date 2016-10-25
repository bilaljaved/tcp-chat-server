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
        sock.write("Room named "+roomName+" created successfully");
    }

    rooms.setItem(roomName,room);

}

function removeRoom(roomName)
{
    var room = rooms.getItem(roomName);
    var targetUsers = room.users;

    for(var i =0; i<targetUsers.length ; i++)
    {
        var userName = targetUsers[i];
        var user = users.getItem(userName);
        room.removeUser(userName);
        user.room = null;
        user.write("Chat room you're currently in has been deleted, you're automatically ejected from it. You can create your own using /create_room [RoomName]\n");

    }

    rooms.removeItem(roomName);

}

function listAllRooms(sock)
{
   if(rooms.length == 0 ) sock.write("There are no rooms at the time. You can create your own using /create_room [RoomName]\n");

   rooms.each(function(key, room){

       var str = room.name + "("+room.getUserCount()+")";

       sock.write(str+ "\n");
   });

}



function broadcastMessage(sock,msg,system)
{
    if(sock.room == null)
        return;

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

    sock.write('Welcome to the world of SAURAN\n');

    sock.write('Login Name?\n');
    sock.name = '';
    sock.room = null;

    sockets.push(sock);

    sock.on('data', function(data)
    {
        // client writes message
        console.log("DATA = " + data);

        data = (data+"");
        data = data.replace(/(\r\n|\n|\r)/gm,"");

        console.log("SOCKET NAME = "+sock.name);
        if(sock.name == undefined || sock.name == "undefined" || sock.name == null || sock.name == '')
        {
            var isValid = isValidString(data);
            var userExists = users.hasItem(data);

            if(isAlphanumeric(data) && isValid && !userExists)
            {
                console.log(data);

                sock.name = data;
                users.setItem(data,sock);
            }
            else
            {
                var msg = "The name you entered is not valid, Try again\n";
                if(userExists)
                    msg = "Sorry, the name is already taken, Try again\n";

                sock.write(msg);
                return;
            }

            sock.write("Welcome "+ data + "\n");
            return;

        }

        if (data.startsWith('/quit'))
        {

            console.log('exit command received: ' + sock.remoteAddress + ':' + sock.remotePort + '\n');

            sock.write("BYE "+sock.name+". Hope to see you soon\n");
            sock.destroy();
            users.removeItem(sock.name);

        }
        else if(data.startsWith('/create_room'))
        {
            if(sock.room != null)
            {
                sock.write("You are already in a room\n");
                return;
            }

            var splitted = data.split(" ");

            if(splitted.length < 2)
            {
                sock.write("Please specify a name for room e.g. create_room MyHeaven\n");
                return;

            }

            isValid = isValidString(splitted[1]);

            if(!isValid || rooms.hasItem(splitted[1]))
            {
                sock.write("Seems like the room name you entered is not valid, Try Again... \n");
                return;
            }


            createRoom(sock,splitted[1]);

        }
        else if(data.startsWith('/join'))
        {
            if(sock.room != null)
            {
                sock.write("You are already in a room, Please leave this room if you want to join another\n");
                return;
            }

            splitted = data.split(" ");

            if(splitted.length < 2)
            {
                sock.write("Please specify a name for room e.g. /join MyHeaven\n");
                return;
            }

            var roomName = splitted[1];

            isValid = isValidString(roomName);

            if(!isValid || !rooms.hasItem(roomName))
            {
                sock.write("Seems like the room name you entered is not valid, Try Again... \n");
                return;
            }

            var roomToJoin = rooms.getItem(roomName);
            roomToJoin.addUser(sock.name);
            sock.room = roomToJoin;

            sock.write("Entering Room "+roomName+"\n");
            roomToJoin.listAllUsers(sock);
            broadcastMessage(sock,"New User Joined Chat: "+ sock.name +"\n",true);
        }
        else if(data.startsWith('/rooms'))
        {
            listAllRooms(sock);
        }
        else if(data.startsWith('/leave'))
        {
            if(sock.room == null)
            {
                sock.write("You are not in any room right now\n");
                return;
            }

            if(!rooms.hasItem(sock.room.name))
            {
                sock.write("Something goes wrong. Please exit and try reconnecting to server \n");
                return;
            }

            sock.write("You've left the room "+ sock.room.name + "\n");
            broadcastMessage(sock,"User has left the chat : "+sock.name + "\n",true);
            sock.room.removeUser(sock.name);
            sock.room = null;

        }
        else if(data.startsWith('/delete_room'))
        {
            splitted = data.split(" ");

            if(splitted.length < 2)
            {
                sock.write("Please specify a name for room e.g. /delete_room MyHeaven\n");
                return;
            }
            roomName = splitted[1];

            if(roomName == "Default") {
                sock.write("You can not delete Default room");
                return;
            }

            var roomToDelete = rooms.getItem(roomName);

            if(roomToDelete == undefined)
            {
                sock.write("There's no such group named "+roomName+"\n");
                return;
            }

            if(roomToDelete.owner != sock.name)
            {
                sock.write("Only owner of a chat room can delete the room.\n");
                return;
            }

            removeRoom(roomName);

        }
        else
        {
            rooms.each(function(a,b){
                console.log("Room --------> Name = "+ a + "UserCount ="+ b.getUserCount() + "\n");
            });

            users.each(function(a,b){
                console.log("User -------->  Key = "+ a + "Value ="+ b.name + "\n");
            });

            broadcastMessage(sock, data);
        }

    });

    sock.on('end', function() { // client disconnects
        console.log('Disconnected\n');
        sock.destroy();
        users.removeItem(sock.name);
    });
}


var svr = net.createServer(acceptConnection);
createRoom(null,"Default");
svr.listen(5000, '0.0.0.0');

console.log('Chat Server Created');

