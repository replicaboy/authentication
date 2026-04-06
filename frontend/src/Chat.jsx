import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Menu, X, Search, MoreVertical, Phone, Video, Paperclip, Camera, ShieldCheck, Bell, UserPlus, Check, Trash2, FileText, XCircle } from 'lucide-react';
import { io } from 'socket.io-client';
import axios from 'axios';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
const socket = io(BACKEND_URL); 

const Chat = ({ onLogout }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null); 
  
  // Profile States
  const [myName, setMyName] = useState(localStorage.getItem('candy_userName') || 'Agent'); 
  const [myProfilePic, setMyProfilePic] = useState(localStorage.getItem('candy_userPic') || null); 
  const myEmail = localStorage.getItem('candy_email'); 
  const [myId, setMyId] = useState(null); 
  
  // Friends & Notifications States
  const [friends, setFriends] = useState([]);
  const [friendRequests, setFriendRequests] = useState([]);
  const [addEmail, setAddEmail] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [showChatMenu, setShowChatMenu] = useState(false);
  
  // File Attachment States
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);

  // Typing Effect State
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeout = useRef(null); 
  
  // Refs
  const scrollRef = useRef(null);
  const fileInputRef = useRef(null);
  const attachmentInputRef = useRef(null);

  // --- Profile Fetching ---
  const fetchProfile = async () => {
    if (!myEmail) return;
    try {
      const res = await axios.get(`${BACKEND_URL}/api/users/${myEmail}`);
      setMyId(res.data._id);
      setFriends(res.data.friends || []);
      setFriendRequests(res.data.friendRequests || []);
      if(res.data.name && res.data.name !== 'Agent') {
        setMyName(res.data.name); localStorage.setItem('candy_userName', res.data.name);
      }
      if(res.data.avatar) {
        setMyProfilePic(res.data.avatar); localStorage.setItem('candy_userPic', res.data.avatar);
      }
    } catch (error) { console.error("Error fetching profile:", error); }
  };
  useEffect(() => { fetchProfile(); }, []);

  // --- Save Profile to DB ---
  const saveProfileToDB = async (updatedName, updatedPic) => {
    if (!myEmail) return;
    try {
      await axios.put(`${BACKEND_URL}/api/users/update`, { email: myEmail, name: updatedName, avatar: updatedPic });
    } catch (error) { console.error("Failed to update profile", error); }
  };

  const allContacts = [
    { _id: 'global', name: "Global Group", role: "Public Channel", email: "global", avatar: null },
    ...friends.map(f => ({ ...f, role: "Friend", online: true })) 
  ];

  const getRoomId = () => {
    if (!selectedChat || !myId) return null;
    if (selectedChat._id === 'global') return 'global';
    return [myId, selectedChat._id].sort().join('_'); 
  };
  const currentRoomId = getRoomId();

  // --- Chat History Fetching ---
  useEffect(() => {
    const fetchChatHistory = async () => {
      if (!currentRoomId) return;
      try {
        const res = await axios.get(`${BACKEND_URL}/api/messages/${currentRoomId}`);
        setChats(res.data);
      } catch (error) { console.error("Error fetching chats:", error); }
    };
    fetchChatHistory();
  }, [currentRoomId]);

  // --- Socket Listeners (Receive, Delete, Clear, Typing) ---
  useEffect(() => {
    // Message Receive
    socket.on('receive_message', (data) => {
      setChats((prev) => prev.some(msg => msg.id === data.id) ? prev : [...prev, data]);
    });
    
    // Message Delete
    socket.on('message_deleted', (deletedId) => {
      setChats((prev) => prev.filter(msg => msg.id !== deletedId));
    });

    // Chat Clear
    socket.on('chat_cleared', (clearedRoomId) => {
      if (currentRoomId === clearedRoomId) setChats([]);
      else setChats((prev) => prev.filter(msg => msg.chatId !== clearedRoomId));
    });

    // Typing Status
    socket.on('user_typing', (roomId) => {
      if (roomId === currentRoomId) setIsTyping(true);
    });
    socket.on('user_stopped_typing', (roomId) => {
      if (roomId === currentRoomId) setIsTyping(false);
    });

    return () => { 
      socket.off('receive_message'); 
      socket.off('message_deleted'); 
      socket.off('chat_cleared'); 
      socket.off('user_typing');
      socket.off('user_stopped_typing');
    };
  }, [currentRoomId]);

  // --- Auto Scroll ---
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [chats, selectedChat, isTyping]);

  // --- File Attachment Handler ---
  const handleAttachment = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const isImage = file.type.startsWith('image/');
    const reader = new FileReader();

    reader.onloadend = () => {
      setSelectedFile({
        data: reader.result,
        type: isImage ? 'image' : 'document',
        name: file.name
      });
      setFilePreview(isImage ? reader.result : file.name);
    };
    reader.readAsDataURL(file);
  };

  // --- Typing Handler ---
  const handleTyping = (e) => {
    setMessage(e.target.value);
    
    if (!currentRoomId) return;
    
    // Tell backend we are typing
    socket.emit('typing', currentRoomId);
    
    // Stop typing after 2 seconds of inactivity
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      socket.emit('stop_typing', currentRoomId);
    }, 2000);
  };

  // --- Send Message ---
  const handleSend = async (e) => {
    e.preventDefault();
    if ((!message.trim() && !selectedFile) || !selectedChat || !currentRoomId) return;

    const newMsg = {
      id: Date.now().toString(),
      text: message,
      sender: "me",
      senderName: myName, 
      chatId: currentRoomId, 
      time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
      avatar: myProfilePic,
      attachment: selectedFile?.data || null,
      attachmentType: selectedFile?.type || null,
      fileName: selectedFile?.name || null
    };

    setChats((prev) => [...prev, newMsg]);
    socket.emit('send_message', { ...newMsg, sender: "other" });
    
    // Stop typing effect when message is sent
    socket.emit('stop_typing', currentRoomId);
    clearTimeout(typingTimeout.current);

    setMessage(''); 
    setSelectedFile(null);
    setFilePreview(null);
  };

  // --- Delete Specific Message ---
  const deleteMessage = (msgId) => {
    socket.emit('delete_message', msgId);
    setChats((prev) => prev.filter(msg => msg.id !== msgId));
  };

  // --- Clear Entire Chat ---
  const clearChat = () => {
    if(window.confirm("Are you sure you want to clear this entire chat?")) {
      socket.emit('clear_chat', currentRoomId);
      setChats([]);
      setShowChatMenu(false);
    }
  };

  // --- Profile DP Handler ---
  const handleProfilePicChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width, height = img.height;
          if (width > height) { if (width > 150) { height *= 150 / width; width = 150; } } 
          else { if (height > 150) { width *= 150 / height; height = 150; } }
          canvas.width = width; canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
          setMyProfilePic(compressedBase64); 
          localStorage.setItem('candy_userPic', compressedBase64);
          saveProfileToDB(myName, compressedBase64);
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    }
  };

  // --- Friend Request Handlers ---
  const sendFriendRequest = async (e) => {
    e.preventDefault();
    if(!addEmail.trim()) return;
    try {
      const res = await axios.post(`${BACKEND_URL}/api/users/request`, { myEmail, targetEmail: addEmail.trim() });
      alert(res.data.message || "Request Sent!");
      setAddEmail('');
    } catch (error) { alert(error.response?.data?.message || "Error sending request"); }
  };

  const acceptRequest = async (requesterEmail) => {
    try {
      await axios.post(`${BACKEND_URL}/api/users/accept`, { myEmail, requesterEmail });
      alert("Friend added!");
      fetchProfile(); 
      setShowNotifications(false);
    } catch (error) { alert("Error accepting request"); }
  };

  const currentChats = chats.filter(chat => chat.chatId === currentRoomId);

  return (
    <div className="flex h-[100dvh] bg-[#050505] text-slate-200 overflow-hidden font-sans relative">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 rounded-full blur-[120px]" />
      </div>

      {!selectedChat && (
        <div className="absolute top-4 left-4 md:hidden z-30">
          <button onClick={() => setIsSidebarOpen(true)} className="p-3 text-slate-300 hover:text-white bg-slate-900/80 rounded-xl backdrop-blur-md border border-slate-700 shadow-lg"><Menu size={24} /></button>
        </div>
      )}

      {/* --- SIDEBAR --- */}
      <AnimatePresence>
        {(isSidebarOpen || window.innerWidth >= 768) && (
          <motion.div initial={{ x: -300, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -300, opacity: 0 }} transition={{ type: "spring", bounce: 0, duration: 0.4 }} className={`fixed inset-y-0 left-0 z-50 w-72 lg:w-80 bg-slate-950/80 backdrop-blur-2xl border-r border-slate-800/50 flex flex-col transform md:relative md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
            <div className="p-5 flex items-center justify-between border-b border-slate-800/50">
              <h2 className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">Candy chat</h2>
              <div className="flex items-center gap-2">
                <button onClick={() => setShowNotifications(true)} className="relative p-2 text-slate-400 hover:text-white transition-colors">
                  <Bell size={20} />
                  {friendRequests.length > 0 && <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">{friendRequests.length}</span>}
                </button>
                <button className="md:hidden text-slate-400 hover:text-white" onClick={() => setIsSidebarOpen(false)}><X size={24} /></button>
              </div>
            </div>

            <div className="p-4 border-b border-slate-800/50">
              <form onSubmit={sendFriendRequest} className="relative group flex items-center">
                <input 
                  type="email" required value={addEmail} onChange={(e) => setAddEmail(e.target.value)}
                  placeholder="Add friend by email..." 
                  className="w-full bg-slate-900/50 border border-slate-800 rounded-xl pl-4 pr-10 py-2.5 text-sm focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all placeholder-slate-600" 
                />
                <button type="submit" className="absolute right-2 p-1.5 text-blue-400 hover:text-blue-300 transition-colors">
                  <UserPlus size={18} />
                </button>
              </form>
            </div>

            {/* Users List */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar px-3 space-y-1 mt-2">
              {allContacts.map((user) => (
                <motion.div key={user._id} whileHover={{ scale: 1.02, backgroundColor: "rgba(30, 41, 59, 0.5)" }} onClick={() => { setSelectedChat(user); setIsSidebarOpen(false); }} className={`flex items-center p-3 rounded-xl cursor-pointer transition-colors border ${selectedChat?._id === user._id ? 'bg-slate-800 border-slate-700/50 shadow-lg' : 'border-transparent hover:border-slate-700/50'}`}>
                  <div className="relative flex-shrink-0">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-800 to-slate-700 flex items-center justify-center font-bold text-slate-300 border border-slate-600 overflow-hidden">
                      {user.avatar ? <img src={user.avatar} alt="DP" className="w-full h-full object-cover" /> : user.name.charAt(0).toUpperCase()}
                    </div>
                  </div>
                  <div className="ml-3 flex-1 overflow-hidden">
                    <h3 className="text-sm font-semibold text-slate-200 truncate">{user.name}</h3>
                    <p className="text-xs text-slate-500 truncate">{user.role}</p>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Profile Section */}
            <div className="p-4 border-t border-slate-800/50 bg-slate-900/30 flex flex-col gap-3">
               <div className="flex items-center gap-3 bg-slate-900 p-3 rounded-xl border border-slate-800">
                  <div className="relative group cursor-pointer flex-shrink-0" onClick={() => fileInputRef.current?.click()}>
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center font-bold text-white overflow-hidden border-2 border-slate-600">
                      {myProfilePic ? <img src={myProfilePic} alt="My DP" className="w-full h-full object-cover" /> : myName.charAt(0).toUpperCase()}
                    </div>
                    <div className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Camera size={18} className="text-white" />
                    </div>
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <input type="text" value={myName} onChange={(e) => { setMyName(e.target.value); localStorage.setItem('candy_userName', e.target.value); }} onBlur={() => saveProfileToDB(myName, myProfilePic)} className="text-sm font-bold text-white bg-transparent border-b border-transparent hover:border-slate-600 focus:border-blue-500 focus:outline-none w-full pb-0.5 transition-colors truncate" title="Click to edit name" />
                    <p className="text-[10px] text-slate-400 mt-0.5">{myEmail}</p>
                  </div>
                  <input type="file" ref={fileInputRef} onChange={handleProfilePicChange} accept="image/*" className="hidden" />
               </div>
               <button onClick={onLogout} className="w-full py-2.5 bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 rounded-xl text-sm font-medium transition-all">Logout</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- NOTIFICATION MODAL --- */}
      <AnimatePresence>
        {showNotifications && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="w-full max-w-sm bg-slate-900 border border-slate-700 p-6 rounded-2xl shadow-2xl">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-white flex items-center gap-2"><Bell size={20} className="text-purple-400"/> Notifications</h3>
                <button onClick={() => setShowNotifications(false)} className="text-slate-400 hover:text-white"><X size={20} /></button>
              </div>
              {friendRequests.length === 0 ? (
                <p className="text-center text-slate-500 py-4">No new friend requests.</p>
              ) : (
                <div className="space-y-3">
                  {friendRequests.map(req => (
                    <div key={req._id} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-xl border border-slate-700">
                      <div>
                        <p className="text-sm font-bold text-white">{req.name || 'Agent'}</p>
                        <p className="text-[10px] text-slate-400">{req.email}</p>
                      </div>
                      <button onClick={() => acceptRequest(req.email)} className="p-2 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 rounded-lg transition-colors border border-emerald-500/30">
                        <Check size={18} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- MAIN CHAT AREA --- */}
      <div className="flex-1 flex flex-col relative z-10 w-full h-[100dvh]">
        {selectedChat ? (
          <>
            <header className="flex-shrink-0 h-16 md:h-20 px-4 md:px-8 border-b border-slate-800/50 bg-slate-950/40 backdrop-blur-xl flex items-center justify-between z-20">
              <div className="flex items-center gap-3 md:gap-4">
                <button className="md:hidden p-1.5 -ml-2 rounded-lg text-slate-400 hover:bg-slate-800/50 transition-colors" onClick={() => setIsSidebarOpen(true)}><Menu size={24} /></button>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center font-bold text-white shadow-lg shadow-purple-500/20 overflow-hidden">
                    {selectedChat.avatar ? <img src={selectedChat.avatar} alt="DP" className="w-full h-full object-cover" /> : selectedChat.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h2 className="font-bold text-white tracking-wide text-sm md:text-base">{selectedChat.name}</h2>
                    <p className="text-[10px] md:text-xs text-emerald-400 font-medium">Online</p>
                  </div>
                </div>
              </div>
              
              {/* --- Clear Chat Menu --- */}
              <div className="relative">
                <button onClick={() => setShowChatMenu(!showChatMenu)} className="p-2.5 hover:bg-slate-800/50 rounded-xl transition-colors text-slate-400"><MoreVertical size={20} /></button>
                {showChatMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-50">
                    <button onClick={clearChat} className="w-full text-left px-4 py-3 text-sm text-red-400 hover:bg-slate-800 flex items-center gap-2 transition-colors">
                      <Trash2 size={16} /> Clear Chat
                    </button>
                  </div>
                )}
              </div>
            </header>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-8 space-y-5 custom-scrollbar">
              <AnimatePresence>
                {currentChats.map((chat) => (
                  <motion.div key={chat.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className={`flex flex-col group ${chat.sender === 'me' ? 'items-end' : 'items-start'}`}>
                    {chat.sender === 'other' && <span className="text-[10px] md:text-[11px] text-slate-400 mb-1 ml-9 md:ml-12 font-medium">{chat.senderName || selectedChat.name}</span>}

                    <div className="flex items-end gap-2 max-w-[85%] md:max-w-[70%] relative">
                      
                      {/* --- Delete Message Button --- */}
                      {chat.sender === 'me' && (
                        <button onClick={() => deleteMessage(chat.id)} className="opacity-0 group-hover:opacity-100 p-2 text-slate-500 hover:text-red-400 transition-all absolute top-1/2 -left-10 transform -translate-y-1/2">
                          <Trash2 size={16} />
                        </button>
                      )}

                      {chat.sender === 'other' && (
                        <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-slate-800 flex-shrink-0 border border-slate-700 overflow-hidden shadow-lg">
                           {chat.avatar ? <img src={chat.avatar} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-xs font-bold text-slate-300">{(chat.senderName || selectedChat.name).charAt(0).toUpperCase()}</div>}
                        </div>
                      )}
                      
                      <div className={`p-3 md:p-4 rounded-2xl ${chat.sender === 'me' ? 'bg-gradient-to-br from-blue-600 to-purple-600 text-white rounded-br-sm shadow-[0_5px_20px_rgba(124,58,237,0.2)]' : 'bg-slate-900/80 border border-slate-800/50 text-slate-200 rounded-bl-sm backdrop-blur-md'}`}>
                        
                        {/* --- Attachment Render --- */}
                        {chat.attachment && (
                          <div className="mb-2">
                            {chat.attachmentType === 'image' ? (
                              <img src={chat.attachment} alt="attachment" className="rounded-xl max-h-60 object-contain border border-white/20" />
                            ) : (
                              <a href={chat.attachment} download={chat.fileName} className="flex items-center gap-2 p-3 bg-black/20 rounded-xl hover:bg-black/40 transition-colors">
                                <FileText size={24} className="text-blue-300" />
                                <span className="text-sm underline break-all">{chat.fileName}</span>
                              </a>
                            )}
                          </div>
                        )}
                        
                        {chat.text && <p className="text-[14px] md:text-[15px] leading-relaxed break-words">{chat.text}</p>}
                      </div>

                      {chat.sender === 'me' && (
                        <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-slate-800 flex-shrink-0 border border-slate-700 overflow-hidden shadow-lg shadow-purple-500/20">
                          {myProfilePic ? <img src={myProfilePic} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-xs font-bold text-white">{myName.charAt(0).toUpperCase()}</div>}
                        </div>
                      )}
                    </div>
                    <span className="text-[10px] md:text-[11px] text-slate-500 mt-1.5 px-1 font-medium">{chat.time}</span>
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* --- Typing Indicator --- */}
              {isTyping && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 max-w-[85%] md:max-w-[70%] text-slate-400 mt-2">
                  <div className="w-7 h-7 rounded-full bg-slate-800 flex-shrink-0 border border-slate-700 overflow-hidden">
                    {selectedChat.avatar ? <img src={selectedChat.avatar} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-xs font-bold text-slate-300">{selectedChat.name.charAt(0).toUpperCase()}</div>}
                  </div>
                  <div className="p-3 md:p-4 rounded-2xl bg-slate-900/80 border border-slate-800/50 rounded-bl-sm flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></span>
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></span>
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></span>
                  </div>
                </motion.div>
              )}
            </div>

            {/* --- Message Input Area with File Preview --- */}
            <div className="flex-shrink-0 p-3 md:p-4 bg-slate-950/80 backdrop-blur-xl border-t border-slate-800/50 flex flex-col gap-2">
              
              {/* File Preview Box */}
              {filePreview && (
                <div className="relative self-start bg-slate-800 p-2 rounded-xl border border-slate-700 flex items-center gap-3">
                  {selectedFile.type === 'image' ? (
                    <img src={filePreview} alt="preview" className="w-16 h-16 object-cover rounded-lg" />
                  ) : (
                    <div className="w-16 h-16 bg-slate-700 rounded-lg flex items-center justify-center"><FileText size={24} className="text-blue-400"/></div>
                  )}
                  <div className="max-w-[150px]">
                    <p className="text-xs text-white truncate">{selectedFile.name}</p>
                    <p className="text-[10px] text-slate-400">Ready to send</p>
                  </div>
                  <button onClick={() => { setSelectedFile(null); setFilePreview(null); }} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 hover:scale-110 transition-transform">
                    <XCircle size={18} />
                  </button>
                </div>
              )}

              <form onSubmit={handleSend} className="max-w-4xl mx-auto w-full flex items-end gap-2 bg-slate-900/80 border border-slate-700/50 p-1.5 md:p-2 rounded-3xl shadow-xl focus-within:border-purple-500/50 transition-colors">
                
                {/* File Attachment Button */}
                <button type="button" onClick={() => attachmentInputRef.current?.click()} className="p-3 text-slate-400 hover:text-blue-400 transition-colors">
                  <Paperclip size={20} />
                </button>
                <input type="file" ref={attachmentInputRef} onChange={handleAttachment} accept="image/*,.pdf,.doc,.docx,.txt" className="hidden" />
                
                <textarea
                  value={message} 
                  onChange={handleTyping} // <-- Typing Handler Here
                  placeholder="Type a message or attach a file..."
                  className="flex-1 bg-transparent border-none text-slate-200 placeholder-slate-500 focus:outline-none resize-none py-2.5 md:py-3.5 px-2 max-h-24 min-h-[44px] text-[14px] md:text-[15px]"
                  rows="1" onKeyDown={(e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(e); } }}
                />
                
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} type="submit" disabled={!message.trim() && !selectedFile} className="p-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-2xl shadow-lg shadow-purple-500/25 disabled:opacity-50 disabled:cursor-not-allowed m-1 transition-all">
                  <Send size={18} className="ml-0.5" />
                </motion.button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-6 p-10 text-center bg-slate-950/20 backdrop-blur-sm relative overflow-hidden">
             <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/10 via-slate-950 to-purple-900/10" />
             <div className="relative z-10 flex flex-col items-center gap-6">
                 <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-blue-600/30 to-purple-600/30 flex items-center justify-center border border-purple-500/20 shadow-xl shadow-purple-500/10">
                     <ShieldCheck size={48} className="text-purple-400" />
                 </div>
                 <h1 className="text-3xl md:text-4xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">Candy chat</h1>
                 <p className="max-w-md text-slate-500 font-medium text-sm md:text-base">Welcome to the secure network. Search an agent by email in the sidebar to send a friend request.</p>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Chat;