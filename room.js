function Room(name,owner) {
  this.name = name;
  this.owner = owner;
  this.users = [];
};

Room.prototype.addUser = function(user) {

    this.users.push(user);

};

Room.prototype.removeUser = function(userName)
{
  this.users = this.users.filter(function(item) {
    return item !== userName;
  });
};

Room.prototype.listAllUsers = function(socket)
{
  for(var i = 0; i < this.users.length; i++)
  {

    var user = this.users[i];
    var str = user;
    if(user === socket.name)
    {
      str += " (YOU)";
    }
    str+= "\n";

    socket.write(str);
  }

};



Room.prototype.getUserCount = function() {

  return this.users.length;
};





module.exports = Room;
