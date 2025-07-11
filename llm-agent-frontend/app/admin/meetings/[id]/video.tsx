"use client";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import io from "socket.io-client";
// @ts-ignore
import Peer from "simple-peer";

const SOCKET_SERVER_URL = "http://localhost:3001";

export default function VideoMeeting() {
  const params = useParams();
  let roomId = '';
  if (params && typeof (params as any).id !== 'undefined' && (params as any).id !== null) {
    roomId = String((params as any).id);
  }
  const [peers, setPeers] = useState<{ peer: any, peerID: string }[]>([]);
  const userVideo = useRef<HTMLVideoElement>(null);
  const peersRef = useRef<{ peerID: string, peer: any }[]>([]);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [socket, setSocket] = useState<any>(null);

  useEffect(() => {
    const s = io(SOCKET_SERVER_URL);
    setSocket(s);
    let localStream: MediaStream | null = null;
    
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(stream => {
        setStream(stream);
        localStream = stream;
        if (userVideo.current) {
          userVideo.current.srcObject = stream;
        }
        
        if (roomId) {
          if (s.id) {
            s.emit("join-room", roomId, s.id);
          } else {
            s.once('connect', () => {
              s.emit("join-room", roomId, s.id);
            });
          }
        }
        
        s.on("all-users", (users: string[]) => {
          const peersArr: { peer: any, peerID: string }[] = [];
          users.forEach(userID => {
            if (stream) {
              const peer = createPeer(userID, String(s.id), stream, s);
              peersRef.current.push({ peerID: userID, peer });
              peersArr.push({ peer, peerID: userID });
            }
          });
          setPeers(peersArr);
        });
        
        s.on("user-connected", (userId: string) => {
          if (stream) {
            const peer = addPeer(userId, stream, s);
            peersRef.current.push({ peerID: userId, peer });
            setPeers(users => [...users, { peer, peerID: userId }]);
          }
        });
        
        s.on("signal", handleSignal);
        s.on("user-disconnected", (userId: string) => {
          setPeers(users => users.filter((p: any) => p.peerID !== userId));
          peersRef.current = peersRef.current.filter(p => p.peerID !== userId);
        });
      })
      .catch(error => {
        console.error('Kamera/Mikrofon erişim hatası:', error);
        if (error.name === 'NotAllowedError') {
          alert('Kamera ve mikrofon izni verilmedi. Lütfen tarayıcı ayarlarından izin verin.');
        } else if (error.name === 'NotFoundError') {
          alert('Kamera veya mikrofon bulunamadı. Lütfen cihazlarınızı kontrol edin.');
        } else if (error.name === 'NotReadableError') {
          alert('Kamera veya mikrofon başka bir uygulama tarafından kullanılıyor.');
        } else {
          alert('Kamera/mikrofon erişiminde bir hata oluştu: ' + error.message);
        }
      });
    
    return () => {
      s.disconnect();
      if (localStream) {
        localStream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
      }
    };
    // eslint-disable-next-line
  }, [roomId]);

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

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900">
      <h1 className="text-3xl font-bold text-white mb-6">Video Toplantı</h1>
      <div className="flex gap-6 flex-wrap justify-center">
        <div className="flex flex-col items-center">
          <video ref={userVideo} autoPlay playsInline muted className="rounded-lg border-4 border-blue-400 w-72 h-56 bg-black" />
          <span className="text-white mt-2">Sen</span>
        </div>
        {peers.map(({ peer, peerID }) => (
          <Video key={peerID} peer={peer} />
        ))}
      </div>
    </div>
  );
}

function Video({ peer }: { peer: any }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    peer.on("stream", (stream: MediaStream) => {
      if (ref.current) ref.current.srcObject = stream;
    });
  }, [peer]);
  return (
    <div className="flex flex-col items-center">
      <video ref={ref} autoPlay playsInline className="rounded-lg border-4 border-purple-400 w-72 h-56 bg-black" />
      <span className="text-white mt-2">Katılımcı</span>
    </div>
  );
} 