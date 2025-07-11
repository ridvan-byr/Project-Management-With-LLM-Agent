"use client";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { FiCopy, FiMic, FiMicOff, FiVideo, FiVideoOff } from "react-icons/fi";
import { useAuth } from "../../../context/AuthContext";

export default function Lobby() {
  const params = useParams();
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const roomId = String((params as any).roomId ?? '');
  const [name, setName] = useState("");
  const [videoOn, setVideoOn] = useState(true);
  const [audioOn, setAudioOn] = useState(true);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [copied, setCopied] = useState(false);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudio, setSelectedAudio] = useState<string>("");
  const [selectedVideo, setSelectedVideo] = useState<string>("");
  const [audioLevel, setAudioLevel] = useState(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const animationRef = useRef<number | null>(null);

  // Authentication kontrolü
  useEffect(() => {
    if (!isAuthenticated) {
      // Kullanıcı giriş yapmamışsa login sayfasına yönlendir
      // Giriş yaptıktan sonra bu sayfaya geri dönmesi için returnUrl'i sakla
      localStorage.setItem('returnUrl', `/call/${roomId}/lobby`);
      router.push('/login');
      return;
    }
  }, [isAuthenticated, router, roomId]);

  // Kullanıcı giriş yapmamışsa hiçbir şey gösterme
  if (!isAuthenticated) {
    return null;
  }

  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then(devices => {
      setAudioDevices(devices.filter(d => d.kind === "audioinput"));
      setVideoDevices(devices.filter(d => d.kind === "videoinput"));
    });
  }, []);

  useEffect(() => {
    const constraints: MediaStreamConstraints = {
      video: videoOn ? (selectedVideo ? { deviceId: { exact: selectedVideo } } : true) : false,
      audio: audioOn ? (selectedAudio ? { deviceId: { exact: selectedAudio } } : true) : false,
    };
    if (videoOn || audioOn) {
      navigator.mediaDevices.getUserMedia(constraints).then(s => {
        setStream(s);
      });
    } else {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        setStream(null);
      }
    }
    return () => {
      if (stream) stream.getTracks().forEach(track => track.stop());
    };
    // eslint-disable-next-line
  }, [videoOn, audioOn, selectedAudio, selectedVideo]);

  // Video elementini stream ile senkronize et
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.load();
      videoRef.current.play().catch(e => console.log('Video play hatası:', e));
    }
  }, [stream, videoOn]);

  useEffect(() => {
    if (audioOn && stream && selectedAudio) {
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
        // Use average volume
        const avg = dataArrayRef.current.reduce((a, b) => a + b, 0) / dataArrayRef.current.length;
        setAudioLevel(avg);
        animationRef.current = requestAnimationFrame(updateLevel);
      };
      updateLevel();
      return () => {
        if (animationRef.current) cancelAnimationFrame(animationRef.current);
        if (sourceRef.current) sourceRef.current.disconnect();
        if (analyserRef.current) analyserRef.current.disconnect();
      };
    } else {
      setAudioLevel(0);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (sourceRef.current) sourceRef.current.disconnect();
      if (analyserRef.current) analyserRef.current.disconnect();
    }
    // eslint-disable-next-line
  }, [audioOn, stream, selectedAudio]);

  const handleCopy = () => {
    navigator.clipboard.writeText(window.location.origin + `/call/${roomId}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleStart = () => {
    router.push(`/call/${roomId}?name=${encodeURIComponent(name)}`);
  };

  const url = `${window.location.origin}/call/${roomId}`;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-100 via-purple-100 to-white dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl p-10 w-full max-w-lg flex flex-col items-center gap-6 border border-gray-200 dark:border-gray-800">
        <h1 className="text-3xl font-extrabold mb-2 text-blue-700 dark:text-blue-200 drop-shadow">Görüşme Lobisi</h1>
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          muted 
          className="rounded-xl border-4 border-blue-400 w-80 h-56 bg-black mb-2 shadow-lg" 
          style={{ display: videoOn && stream && stream.getVideoTracks().length > 0 ? 'block' : 'none' }}
        />
        <div className="flex flex-col gap-2 w-full">
          <label className="font-semibold text-gray-700 dark:text-gray-200 mb-1 ml-1">Adınızı girin</label>
          <input
            type="text"
            className="rounded-lg border border-gray-300 dark:border-gray-700 px-4 py-2 text-lg mb-2 w-full bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-400 text-black dark:text-white"
            placeholder="Adınız (isteğe bağlı)"
            value={name}
            onChange={e => setName(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-3 w-full">
          <div className="flex items-center gap-4 w-full">
            <button
              onClick={async () => {
                const newAudioOn = !audioOn;
                try {
                  if (newAudioOn) {
                    // Mikrofon açılıyorsa sadece audio track'i ekle
                    const audioStream = await navigator.mediaDevices.getUserMedia({ 
                      video: false, 
                      audio: true 
                    });
                    
                    const audioTrack = audioStream.getAudioTracks()[0];
                    if (audioTrack && stream) {
                      // Mevcut stream'e audio track'i ekle
                      stream.addTrack(audioTrack);
                    }
                  } else {
                    // Mikrofon kapatılıyorsa audio track'i kaldır
                    if (stream) {
                      const audioTracks = stream.getAudioTracks();
                      audioTracks.forEach(track => {
                        stream.removeTrack(track);
                        track.stop();
                      });
                    }
                  }
                  setAudioOn(newAudioOn);
                } catch (error) {
                  console.error('Audio toggle hatası:', error);
                  setAudioOn(newAudioOn);
                }
              }}
              className={`flex items-center justify-center p-3 rounded-xl text-xl shadow transition-all ${audioOn ? 'bg-blue-500 text-white' : 'bg-gray-300 text-gray-700'}`}
              title={audioOn ? 'Mikrofonu Kapat' : 'Mikrofonu Aç'}
            >
              {audioOn ? <FiMic /> : <FiMicOff />}
            </button>
            <select
              className="rounded-lg border border-gray-300 dark:border-gray-700 px-2 py-2 text-base bg-white dark:bg-gray-900 text-black dark:text-white focus:ring-2 focus:ring-blue-400"
              value={selectedAudio}
              onChange={e => setSelectedAudio(e.target.value)}
              style={{ minWidth: 120 }}
            >
              <option value="">Mikrofon Seç</option>
              {audioDevices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || `Mikrofon ${d.deviceId.slice(-4)}`}</option>)}
            </select>
            <button
              onClick={async () => {
                const newVideoOn = !videoOn;
                try {
                  if (newVideoOn) {
                    // Kamera açılıyorsa sadece video track'i ekle
                    const videoStream = await navigator.mediaDevices.getUserMedia({ 
                      video: true, 
                      audio: false 
                    });
                    
                    const videoTrack = videoStream.getVideoTracks()[0];
                    if (videoTrack && stream) {
                      // Mevcut stream'e video track'i ekle
                      stream.addTrack(videoTrack);
                      
                      // Video elementini güncelle
                      if (videoRef.current) {
                        videoRef.current.srcObject = stream;
                      }
                    }
                  } else {
                    // Kamera kapatılıyorsa video track'i kaldır
                    if (stream) {
                      const videoTracks = stream.getVideoTracks();
                      videoTracks.forEach(track => {
                        stream.removeTrack(track);
                        track.stop();
                      });
                    }
                  }
                  setVideoOn(newVideoOn);
                } catch (error) {
                  console.error('Video toggle hatası:', error);
                  setVideoOn(newVideoOn);
                }
              }}
              className={`flex items-center justify-center p-3 rounded-xl text-xl shadow transition-all ${videoOn ? 'bg-blue-500 text-white' : 'bg-gray-300 text-gray-700'}`}
              title={videoOn ? 'Kamerayı Kapat' : 'Kamerayı Aç'}
            >
              {videoOn ? <FiVideo /> : <FiVideoOff />}
            </button>
            <select
              className="rounded-lg border border-gray-300 dark:border-gray-700 px-2 py-2 text-base bg-white dark:bg-gray-900 text-black dark:text-white focus:ring-2 focus:ring-blue-400"
              value={selectedVideo}
              onChange={e => setSelectedVideo(e.target.value)}
              style={{ minWidth: 120 }}
            >
              <option value="">Kamera Seç</option>
              {videoDevices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || `Kamera ${d.deviceId.slice(-4)}`}</option>)}
            </select>
          </div>
          {selectedAudio && (
            <div className="w-full flex flex-col items-center mt-2">
              <div className="w-2/3 h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all"
                  style={{ width: `${Math.min(100, Math.round((audioLevel / 128) * 100))}%` }}
                />
              </div>
              <span className="text-xs text-gray-500 mt-1">Mikrofon Testi</span>
            </div>
          )}
        </div>
        <button
          className="w-full py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-xl font-bold text-lg shadow-lg hover:from-blue-600 hover:to-purple-600 transition-all mb-2 mt-2"
          onClick={handleStart}
        >
          Görüşmeyi Başlat
        </button>
        <div className="flex items-center gap-2 w-full mt-2">
          <button
            onClick={handleCopy}
            className="flex items-center justify-center p-2 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-blue-100 dark:hover:bg-blue-800 transition-all"
            title="Bağlantıyı Kopyala"
          >
            <FiCopy className="text-xl" />
          </button>
          <span className="ml-2 text-sm font-semibold text-gray-600 dark:text-gray-300">
            {copied ? 'Kopyalandı!' : 'Bağlantıyı Kopyala'}
          </span>
          <input
            type="text"
            className="flex-1 rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 text-base bg-white dark:bg-gray-900 select-all focus:outline-none text-black dark:text-white"
            value={url}
            readOnly
            onFocus={e => e.target.select()}
          />
        </div>
        <div className="mt-2 text-gray-500 text-sm text-center">Bu bağlantıyı paylaşarak başkalarını davet edebilirsin.</div>
      </div>
    </div>
  );
} 