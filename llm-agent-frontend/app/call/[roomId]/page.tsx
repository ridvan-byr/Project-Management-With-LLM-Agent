"use client";
import { useEffect, useRef, useState, useMemo } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import io from "socket.io-client";
// @ts-ignore
import Peer from "simple-peer";
import { FiVideo, FiVideoOff, FiMic, FiMicOff, FiMessageSquare, FiUsers, FiX, FiLogOut } from "react-icons/fi";
import { FaCrown } from "react-icons/fa";
import { useAuth } from "../../context/AuthContext";

const SOCKET_SERVER_URL = "http://localhost:3001";

function getInitial(name: string) {
  return name && name.length > 0 ? name[0].toUpperCase() : '?';
}

type VideoProps = { peer: any, name: string, videoOn?: boolean, audioOn?: boolean, isHost?: boolean, onMakeHost?: () => void, canMakeHost?: boolean };

export default function CallPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const roomId = String((params as any).roomId ?? '');
  const userName = searchParams.get('name') || 'Anonim';
  const [peers, setPeers] = useState<{ peer: any, peerID: string, name: string }[]>([]);
  const userVideo = useRef<HTMLVideoElement>(null);
  const peersRef = useRef<{ peerID: string, peer: any, name: string }[]>([]);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [socket, setSocket] = useState<any>(null);
  const [videoOn, setVideoOn] = useState(true);
  const [audioOn, setAudioOn] = useState(true);
  const [showToast, setShowToast] = useState<{ name: string, visible: boolean, type?: string }>({ name: '', visible: false });
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ name: string, message: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [participants, setParticipants] = useState<string[]>([userName]);
  const [speaking, setSpeaking] = useState(false);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const animationRef = useRef<number | null>(null);
  const cancelAnimationRef = useRef<number | null>(null);
  const [hostId, setHostId] = useState<string | null>(null);
  const [meetingEnded, setMeetingEnded] = useState(false);
  // Yönetici durumunu hesapla
  const isHost = useMemo(() => {
    return hostId === socket?.id;
  }, [hostId, socket?.id]);

  // Authentication kontrolü
  useEffect(() => {
    if (!isAuthenticated) {
      // Kullanıcı giriş yapmamışsa login sayfasına yönlendir
      localStorage.setItem('returnUrl', `/call/${roomId}`);
      router.push('/login');
      return;
    }
  }, [isAuthenticated, router, roomId]);

  // Kullanıcı giriş yapmamışsa hiçbir şey gösterme
  if (!isAuthenticated) {
    return null;
  }

  useEffect(() => {
    const s = io(SOCKET_SERVER_URL);
    setSocket(s);
    let localStream: MediaStream;
    // Eğer stream yoksa getUserMedia çağır
    if (!stream) {
      const constraints: MediaStreamConstraints = {};
      if (videoOn) constraints.video = true;
      if (audioOn) constraints.audio = true;
      if (constraints.video || constraints.audio) {
        navigator.mediaDevices.getUserMedia(constraints).then(stream => {
          setStream(stream);
          localStream = stream;
          if (userVideo.current) {
            userVideo.current.srcObject = stream;
          }
          if (roomId) {
            if (s.id) {
              s.emit("join-room", roomId, s.id, userName);
            } else {
              s.once('connect', () => {
                s.emit("join-room", roomId, s.id, userName);
              });
            }
          }
          s.on("all-users", (users: { id: string, name: string }[], hostId: string) => {
            const peersArr: { peer: any, peerID: string, name: string }[] = [];
            const names = [userName];
            users.forEach(u => {
              const peer = createPeer(u.id, String(s.id), stream, s);
              peersRef.current.push({ peerID: u.id, peer, name: u.name || 'Katılımcı' });
              peersArr.push({ peer, peerID: u.id, name: u.name || 'Katılımcı' });
              names.push(u.name || 'Katılımcı');
            });
            setPeers(peersArr);
            setParticipants(names);
            setHostId(hostId);
          });
          s.on("user-connected", (user: { id: string, name: string }) => {
            const peer = addPeer(user.id, stream, s);
            peersRef.current.push({ peerID: user.id, peer, name: user.name || 'Katılımcı' });
            setPeers(users => [...users, { peer, peerID: user.id, name: user.name || 'Katılımcı' }]);
            setParticipants(names => [...names, user.name || 'Katılımcı']);
            setShowToast({ name: user.name || 'Katılımcı', visible: true });
            setTimeout(() => setShowToast({ name: '', visible: false }), 2500);
          });
          s.on("host-changed", (newHostId: string) => {
            setHostId(newHostId);
            setShowToast({ name: 'Yönetici değişti', visible: true });
            setTimeout(() => setShowToast({ name: '', visible: false }), 2500);
          });
          s.on("meeting-ended", () => {
            setMeetingEnded(true);
            setShowToast({ name: 'Toplantı sona erdi', visible: true, type: 'ended' });
            setTimeout(() => {
              setShowToast({ name: '', visible: false });
              router.push('/');
            }, 2500);
          });
          s.on("signal", handleSignal);
          s.on("user-disconnected", (userId: string) => {
            const peerObj = peersRef.current.find((p: any) => p.peerID === userId);
            setPeers(users => users.filter((p: any) => p.peerID !== userId));
            peersRef.current = peersRef.current.filter(p => p.peerID !== userId);
            setParticipants(names => names.filter((_, idx) => idx !== names.findIndex((n, i) => peersRef.current[i]?.peerID === userId)));
            setShowToast({ name: peerObj?.name || 'Katılımcı', visible: true, type: 'left' });
            setTimeout(() => setShowToast({ name: '', visible: false }), 2500);
          });
          // Chat events
          s.on("chat-message", ({ name, message }: { name: string, message: string }) => {
            setChatMessages(msgs => [...msgs, { name, message }]);
          });
        });
      }
    }
    // Eğer stream varsa sadece track'leri enable/disable et
    else {
      stream.getVideoTracks().forEach(track => (track.enabled = videoOn));
      stream.getAudioTracks().forEach(track => (track.enabled = audioOn));
    }
    return () => {
      s.disconnect();
      localStream?.getTracks().forEach(track => track.stop());
    };
    // eslint-disable-next-line
  }, [videoOn, audioOn]);

  // Video elementini stream ile senkronize et
  useEffect(() => {
    if (userVideo.current && stream) {
      userVideo.current.srcObject = stream;
      userVideo.current.load();
      userVideo.current.play().catch(e => console.log('Video play hatası:', e));
    }
  }, [stream]);

  // Video track'lerinin durumunu kontrol et
  useEffect(() => {
    if (stream) {
      const videoTracks = stream.getVideoTracks();
      if (videoTracks.length > 0) {
        videoTracks.forEach(track => {
          track.enabled = videoOn;
        });
      }
    }
  }, [videoOn, stream]);

  // Video elementinin görünürlüğünü kontrol et
  useEffect(() => {
    if (userVideo.current) {
      if (videoOn && stream && stream.getVideoTracks().length > 0) {
        userVideo.current.style.display = 'block';
      } else {
        userVideo.current.style.display = 'none';
      }
    }
  }, [videoOn, stream]);

  // Mikrofon seviyesi ölçümü (sadece kendi kutun için)
  useEffect(() => {
    if (stream && audioOn) {
      // Önce tüm context ve node'ları temizle
      if (animationRef.current) cancelAnimationRef.current;
      if (sourceRef.current) sourceRef.current.disconnect();
      if (analyserRef.current) analyserRef.current.disconnect();
      if (audioContextRef.current) audioContextRef.current.close();
      audioContextRef.current = null;

      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const audioContext = audioContextRef.current;
      if (sourceRef.current) sourceRef.current.disconnect();
      const source = audioContext.createMediaStreamSource(stream);
      sourceRef.current = source;
      if (analyserRef.current) analyserRef.current.disconnect();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;
      source.connect(analyser);
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      dataArrayRef.current = dataArray;
      const updateLevel = () => {
        if (!analyserRef.current || !dataArrayRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArrayRef.current);
        // Ortalama ses seviyesi
        const avg = dataArrayRef.current.reduce((a, b) => a + b, 0) / dataArrayRef.current.length;
        setSpeaking(avg > 25); // Eşik değeri
        animationRef.current = requestAnimationFrame(updateLevel);
      };
      updateLevel();
      return () => {
        if (animationRef.current) cancelAnimationRef.current;
        if (sourceRef.current) sourceRef.current.disconnect();
        if (analyserRef.current) analyserRef.current.disconnect();
        if (audioContextRef.current) audioContextRef.current.close();
        audioContextRef.current = null;
      };
    } else {
      setSpeaking(false);
      if (animationRef.current) cancelAnimationRef.current;
      if (sourceRef.current) sourceRef.current.disconnect();
      if (analyserRef.current) analyserRef.current.disconnect();
      if (audioContextRef.current) audioContextRef.current.close();
      audioContextRef.current = null;
    }
  }, [stream, audioOn]);

  // Sayfadan ayrılınca 'Toplantıdan ayrıldınız' mesajı göster
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      setShowToast({ name: 'Toplantıdan ayrıldınız', visible: true, type: 'self-left' });
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  function createPeer(userToSignal: string, callerID: string, stream: MediaStream, socket: any) {
    const peer = new Peer({
      initiator: true,
      trickle: false,
      stream
    });
    peer.on("signal", (signal: any) => {
      socket.emit("signal", { to: userToSignal, from: callerID, signal });
    });
    return peer;
  }

  function addPeer(incomingID: string, stream: MediaStream, socket: any) {
    const peer = new Peer({
      initiator: false,
      trickle: false,
      stream
    });
    peer.on("signal", (signal: any) => {
      socket.emit("signal", { to: incomingID, from: socket.id, signal });
    });
    return peer;
  }

  function handleSignal({ from, signal }: any) {
    let peerObj = peersRef.current.find((p: any) => p.peerID === from);
    if (peerObj) {
      peerObj.peer.signal(signal);
    }
  }

  // Kamera/mikrofon aç/kapat
  const toggleVideo = async () => {
    if (stream) {
      const newVideoOn = !videoOn;
      try {
        if (newVideoOn) {
          // Kamera açılıyorsa sadece video track'i ekle
          const videoStream = await navigator.mediaDevices.getUserMedia({ 
            video: true, 
            audio: false 
          });
          
          const videoTrack = videoStream.getVideoTracks()[0];
          if (videoTrack) {
            // Mevcut stream'e video track'i ekle
            stream.addTrack(videoTrack);
            
            // Peer bağlantılarını güncelle
            peersRef.current.forEach(({ peer }) => {
              if (peer && peer.replaceTrack) {
                const oldVideoTrack = peer.streams[0]?.getVideoTracks()[0];
                if (oldVideoTrack) {
                  peer.replaceTrack(videoTrack, peer.streams[0], oldVideoTrack);
                } else {
                  // Eğer önceden video track yoksa, yeni track'i ekle
                  peer.addTrack(videoTrack, peer.streams[0]);
                }
              }
            });
            
            // Video elementini güncelle
            if (userVideo.current) {
              userVideo.current.srcObject = stream;
            }
          }
        } else {
          // Kamera kapatılıyorsa video track'i kaldır
          const videoTracks = stream.getVideoTracks();
          videoTracks.forEach(track => {
            stream.removeTrack(track);
            track.stop();
          });
          
          // Peer bağlantılarını güncelle
          peersRef.current.forEach(({ peer }) => {
            if (peer) {
              const oldVideoTrack = peer.streams[0]?.getVideoTracks()[0];
              if (oldVideoTrack) {
                peer.removeTrack(oldVideoTrack, peer.streams[0]);
              }
            }
          });
        }
        // State'i güncelle ama render'ı etkilemesin
        setVideoOn(newVideoOn);
      } catch (error) {
        console.error('Video toggle hatası:', error);
        setVideoOn(newVideoOn);
      }
    }
  };
  const toggleAudio = () => {
    if (stream) {
      const newAudioOn = !audioOn;
      // Sadece audio track'i enable/disable et
      stream.getAudioTracks().forEach(track => (track.enabled = newAudioOn));
      setAudioOn(newAudioOn);
    }
  };

  // Chat send
  const sendMessage = () => {
    if (chatInput.trim() && socket) {
      socket.emit("chat-message", { roomId, name: userName, message: chatInput });
      setChatMessages(msgs => [...msgs, { name: userName, message: chatInput }]);
      setChatInput("");
    }
  };

  // Toplantıdan ayrıl
  const handleLeave = () => {
    router.push('/');
  };

  // Toplantıyı bitir (sadece yönetici)
  const handleEndMeeting = () => {
    if (socket) {
      socket.emit('end-meeting');
    }
  };

  // Yönetici devri
  const handleChangeHost = (peerID: string) => {
    if (socket) {
      socket.emit('change-host', peerID);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-white transition-colors duration-300">
      {/* Toast Notification */}
      {showToast.visible && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg transition-all duration-300 ${
          showToast.type === 'ended' 
            ? 'bg-red-500 text-white' 
            : showToast.type === 'left'
            ? 'bg-yellow-500 text-white'
            : 'bg-green-500 text-white'
        }`}>
          {showToast.type === 'ended' && 'Toplantı sona erdi'}
          {showToast.type === 'left' && `${showToast.name} ayrıldı`}
          {!showToast.type && `${showToast.name} katıldı`}
        </div>
      )}

      {/* Meeting Ended Overlay */}
      {meetingEnded && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-8 rounded-lg text-center">
            <h2 className="text-2xl font-bold mb-4">Toplantı Sona Erdi</h2>
            <p className="text-gray-600 dark:text-gray-300">Ana sayfaya yönlendiriliyorsunuz...</p>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex h-screen">
        {/* Video Grid */}
        <div className="flex-1 p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 h-full">
            {/* User's own video */}
            <div className="relative bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
              <video
                ref={userVideo}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-4 left-4 bg-black bg-opacity-50 text-white px-3 py-1 rounded-lg">
                {userName} {isHost && <FaCrown className="inline ml-2 text-yellow-400" />}
              </div>
              {!videoOn && (
                <div className="absolute inset-0 bg-gray-900 dark:bg-gray-700 flex items-center justify-center">
                  <div className="text-white text-6xl font-bold">
                    {getInitial(userName)}
                  </div>
                </div>
              )}
            </div>

            {/* Other participants */}
            {peers.map(({ peer, name }, index) => (
              <Video
                key={index}
                peer={peer}
                name={name}
                videoOn={videoOn}
                audioOn={audioOn}
                isHost={hostId === peer.peerID}
                onMakeHost={() => handleChangeHost(peer.peerID)}
                canMakeHost={isHost}
              />
            ))}
          </div>
        </div>

        {/* Controls and Chat */}
        <div className="w-80 bg-gray-50 dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex flex-col">
          {/* Participants List */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold mb-3 flex items-center">
              <FiUsers className="mr-2" />
              Katılımcılar ({participants.length})
            </h3>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {participants.map((name, index) => (
                <div key={index} className="flex items-center justify-between text-sm">
                  <span className="flex items-center">
                    {name}
                    {hostId === (index === 0 ? socket?.id : peers[index - 1]?.peerID) && (
                      <FaCrown className="ml-2 text-yellow-500" />
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Chat Section */}
          <div className="flex-1 flex flex-col">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setChatOpen(!chatOpen)}
                className="flex items-center text-lg font-semibold"
              >
                <FiMessageSquare className="mr-2" />
                Sohbet
              </button>
            </div>

            {chatOpen && (
              <div className="flex-1 flex flex-col">
                <div className="flex-1 p-4 overflow-y-auto space-y-2">
                  {chatMessages.map((msg, index) => (
                    <div key={index} className="bg-white dark:bg-gray-700 p-2 rounded-lg">
                      <div className="font-semibold text-sm">{msg.name}</div>
                      <div className="text-sm">{msg.message}</div>
                    </div>
                  ))}
                </div>
                <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                      placeholder="Mesaj yazın..."
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      onClick={sendMessage}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Gönder
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex justify-center space-x-4 mb-4">
              <button
                onClick={toggleVideo}
                className={`p-3 rounded-full ${
                  videoOn 
                    ? 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200' 
                    : 'bg-red-500 text-white'
                }`}
              >
                {videoOn ? <FiVideo /> : <FiVideoOff />}
              </button>
              <button
                onClick={toggleAudio}
                className={`p-3 rounded-full ${
                  audioOn 
                    ? 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200' 
                    : 'bg-red-500 text-white'
                }`}
              >
                {audioOn ? <FiMic /> : <FiMicOff />}
              </button>
            </div>
            <div className="flex justify-center space-x-4">
              <button
                onClick={handleLeave}
                className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 flex items-center"
              >
                <FiLogOut className="mr-2" />
                Ayrıl
              </button>
              {isHost && (
                <button
                  onClick={handleEndMeeting}
                  className="px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 flex items-center"
                >
                  <FiX className="mr-2" />
                  Toplantıyı Sonlandır
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Video({ peer, name, videoOn = true, audioOn = true, isHost = false, onMakeHost, canMakeHost = false }: VideoProps) {
  const ref = useRef<HTMLVideoElement>(null);
  const [videoAvailable, setVideoAvailable] = useState(true);
  const [audioAvailable, setAudioAvailable] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  useEffect(() => {
    peer.on("stream", (stream: MediaStream) => {
      if (ref.current) ref.current.srcObject = stream;
      setVideoAvailable(true);
      const audioTrack = stream.getAudioTracks()[0];
      setAudioAvailable(audioTrack ? audioTrack.enabled : true);
      const videoTrack = stream.getVideoTracks()[0];
      setVideoAvailable(videoTrack ? videoTrack.enabled : true);
      stream.getAudioTracks().forEach(track => {
        track.onended = () => setAudioAvailable(false);
        track.onmute = () => setAudioAvailable(false);
        track.onunmute = () => setAudioAvailable(true);
      });
      stream.getVideoTracks().forEach(track => {
        track.onended = () => setVideoAvailable(false);
        track.onmute = () => setVideoAvailable(false);
        track.onunmute = () => setVideoAvailable(true);
      });
    });
    peer.on("track", (track: MediaStreamTrack, stream: MediaStream) => {
      if (track.kind === 'video' && !track.enabled) {
        setVideoAvailable(false);
      }
      if (track.kind === 'audio' && !track.enabled) {
        setAudioAvailable(false);
      }
    });
  }, [peer]);
  return (
    <div className="flex flex-col items-center relative group transition-all duration-200 shadow-xl rounded-2xl bg-gradient-to-br from-blue-50 via-purple-50 to-white dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-4 hover:scale-105 border border-blue-200 dark:border-gray-700" onContextMenu={canMakeHost ? (e) => { e.preventDefault(); setShowMenu(true); } : undefined}>
      {videoOn && videoAvailable ? (
        <video ref={ref} autoPlay playsInline className="rounded-xl border-4 border-purple-400 w-72 h-56 bg-black shadow-lg" />
      ) : (
        <div className="w-72 h-56 flex items-center justify-center rounded-xl border-4 border-purple-400 bg-gray-800 shadow-lg">
          <span className="text-5xl font-bold text-white drop-shadow">{getInitial(name)}</span>
        </div>
      )}
      <span className="mt-3 flex items-center gap-2 text-lg font-semibold text-gray-800 dark:text-gray-100">
        {name} {isHost && <span className="ml-1 bg-yellow-300 text-yellow-900 px-2 py-0.5 rounded-full text-xs font-bold flex items-center gap-1"><FaCrown className="inline text-base" /> Yönetici</span>}
        {!audioAvailable && <span className="ml-1 bg-red-200 text-red-700 px-2 py-0.5 rounded-full text-xs font-bold flex items-center gap-1"><FiMicOff className="inline text-base" /> Kapalı</span>}
      </span>
      {showMenu && canMakeHost && (
        <div className="absolute top-0 right-0 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow-lg z-50 p-2">
          <button onClick={() => { setShowMenu(false); onMakeHost && onMakeHost(); }} className="text-blue-600 dark:text-blue-300 font-semibold px-3 py-1 hover:bg-blue-100 dark:hover:bg-blue-900 rounded">Yönetici Yap</button>
        </div>
      )}
    </div>
  );
} 