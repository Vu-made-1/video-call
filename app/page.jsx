'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }]

function createPeerId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(16)
    crypto.getRandomValues(bytes)
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function Icon({ name, size = 20 }) {
  const paths = {
    mic: <><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3M8 22h8"/></>,
    micOff: <><path d="M9 9v3a3 3 0 0 0 5.2 2M15 9V5a3 3 0 0 0-5.8-1M19 10v2a7 7 0 0 1-11.2 5.6M12 19v3M8 22h8"/><path d="m3 3 18 18"/></>,
    video: <><path d="m16 13 5 3V8l-5 3M3 6h13v12H3z"/></>,
    videoOff: <><path d="m3 3 18 18M10.7 6H16v10M3 6v12h13v-3.3M16 13l5 3V8l-3.3 2"/></>,
    screen: <><rect x="3" y="3" width="18" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></>,
    message: <><path d="M20 11.5a7.5 7.5 0 0 1-8 7.5 8.5 8.5 0 0 1-3-.5L4 20l1.5-4A7.5 7.5 0 1 1 20 11.5Z"/><path d="M8 11h.01M12 11h.01M16 11h.01"/></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
    more: <><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>,
    phone: <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7 12.8 12.8 0 0 0 .7 2.8 2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5 12.8 12.8 0 0 0 2.8.7 2 2 0 0 1 1.8 2.1Z"/>,
    copy: <><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></>,
    send: <><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></>,
    x: <><path d="m6 6 12 12M18 6 6 18"/></>,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

function RemoteVideo({ participant }) {
  const videoRef = useRef(null)
  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = participant.stream
  }, [participant.stream])
  return <div className="video-tile remote-video"><video ref={videoRef} autoPlay playsInline /><div className="tile-label">{participant.name}</div></div>
}

export default function CallPage() {
  const [roomId, setRoomId] = useState('luma-827-401')
  const [name, setName] = useState('Minh Anh')
  const [joined, setJoined] = useState(false)
  const [micOn, setMicOn] = useState(true)
  const [cameraOn, setCameraOn] = useState(true)
  const [chatOpen, setChatOpen] = useState(true)
  const [remoteParticipants, setRemoteParticipants] = useState([])
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const localVideoRef = useRef(null)
  const localStreamRef = useRef(null)
  const outboundStreamRef = useRef(null)
  const mirrorAnimationRef = useRef(null)
  const peerConnections = useRef(new Map())
  const peerNames = useRef(new Map())
  const peerId = useRef(createPeerId())
  const cursor = useRef(0)

  const signal = useCallback(async (type, to, payload) => {
    await fetch('/api/signal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId, from: peerId.current, to, type, payload }),
    })
  }, [roomId])

  const createConnection = useCallback((remoteId, initiator) => {
    const existing = peerConnections.current.get(remoteId)
    if (existing) return existing
    const connection = new RTCPeerConnection({ iceServers: ICE_SERVERS })
    const stream = outboundStreamRef.current || localStreamRef.current
    stream?.getTracks().forEach((track) => connection.addTrack(track, stream))
    connection.onicecandidate = ({ candidate }) => {
      if (candidate) signal('candidate', remoteId, candidate.toJSON())
    }
    connection.ontrack = ({ streams }) => {
      const stream = streams[0]
      setRemoteParticipants((current) => {
        const found = current.find((participant) => participant.id === remoteId)
        if (found) return current.map((participant) => participant.id === remoteId ? { ...participant, stream } : participant)
        return [...current, { id: remoteId, name: peerNames.current.get(remoteId) || 'Khách', stream }]
      })
    }
    connection.onconnectionstatechange = () => {
      if (['failed', 'closed', 'disconnected'].includes(connection.connectionState)) {
        peerConnections.current.delete(remoteId)
        setRemoteParticipants((current) => current.filter((participant) => participant.id !== remoteId))
      }
    }
    peerConnections.current.set(remoteId, connection)
    if (initiator) {
      connection.createOffer().then((offer) => connection.setLocalDescription(offer).then(() => signal('offer', remoteId, offer)))
    }
    return connection
  }, [signal])

  const handleSignal = useCallback(async (message) => {
    const { from, type, payload } = message
    if (type === 'chat') {
      setMessages((current) => [...current, payload])
      return
    }
    if (type === 'hello') {
      peerNames.current.set(from, payload.name)
      if (peerId.current < from) createConnection(from, true)
      return
    }
    const connection = createConnection(from, false)
    if (type === 'offer') {
      await connection.setRemoteDescription(payload)
      const answer = await connection.createAnswer()
      await connection.setLocalDescription(answer)
      await signal('answer', from, answer)
    } else if (type === 'answer') {
      await connection.setRemoteDescription(payload)
    } else if (type === 'candidate') {
      await connection.addIceCandidate(payload)
    }
  }, [createConnection, signal])

  useEffect(() => {
    if (!joined) return undefined
    if (localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current
    }
    let active = true
    const poll = async () => {
      try {
        const response = await fetch(`/api/signal?roomId=${encodeURIComponent(roomId)}&peerId=${encodeURIComponent(peerId.current)}&after=${cursor.current}`)
        const data = await response.json()
        for (const message of data.messages || []) {
          cursor.current = Math.max(cursor.current, message.id)
          await handleSignal(message)
        }
      } catch {
        if (active) setError('Không kết nối được máy chủ signaling. Hãy thử tải lại trang.')
      }
    }
    signal('hello', null, { name })
    const interval = setInterval(poll, 700)
    poll()
    return () => { active = false; clearInterval(interval) }
  }, [joined, name, roomId, signal, handleSignal])

  useEffect(() => () => {
    localStreamRef.current?.getTracks().forEach((track) => track.stop())
    outboundStreamRef.current?.getVideoTracks().forEach((track) => track.stop())
    if (mirrorAnimationRef.current) cancelAnimationFrame(mirrorAnimationRef.current)
    peerConnections.current.forEach((connection) => connection.close())
  }, [])

  const createMirroredStream = async (stream) => {
    if (typeof document === 'undefined' || typeof HTMLCanvasElement === 'undefined') return stream
    const canvas = document.createElement('canvas')
    canvas.width = 640
    canvas.height = 480
    const context = canvas.getContext('2d')
    if (!context || typeof canvas.captureStream !== 'function') return stream

    const source = document.createElement('video')
    source.muted = true
    source.playsInline = true
    source.srcObject = stream
    await source.play()
    const draw = () => {
      context.save()
      context.clearRect(0, 0, canvas.width, canvas.height)
      context.translate(canvas.width, 0)
      context.scale(-1, 1)
      context.drawImage(source, 0, 0, canvas.width, canvas.height)
      context.restore()
      mirrorAnimationRef.current = requestAnimationFrame(draw)
    }
    draw()
    const mirrored = canvas.captureStream(30)
    stream.getAudioTracks().forEach((track) => mirrored.addTrack(track))
    return mirrored
  }

  const joinRoom = async (event) => {
    event.preventDefault()
    setError('')
    try {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        throw new Error('secure-context')
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      localStreamRef.current = stream
      outboundStreamRef.current = await createMirroredStream(stream)
      setJoined(true)
    } catch (reason) {
      if (reason?.message === 'secure-context') {
        setError('Điện thoại cần mở bằng HTTPS hoặc localhost thì trình duyệt mới cho phép camera/micro.')
      } else if (reason?.name === 'NotAllowedError') {
        setError('Bạn đã từ chối quyền camera/micro. Hãy bật quyền cho trang trong cài đặt trình duyệt rồi thử lại.')
      } else if (reason?.name === 'NotFoundError') {
        setError('Không tìm thấy camera hoặc micro trên thiết bị này.')
      } else {
        setError('Không thể mở camera/micro. Hãy cấp quyền truy cập rồi thử lại.')
      }
    }
  }

  const toggleMic = () => {
    const next = !micOn
    localStreamRef.current?.getAudioTracks().forEach((track) => { track.enabled = next })
    setMicOn(next)
  }
  const toggleCamera = () => {
    const next = !cameraOn
    localStreamRef.current?.getVideoTracks().forEach((track) => { track.enabled = next })
    setCameraOn(next)
  }
  const sendMessage = async (event) => {
    event.preventDefault()
    if (!draft.trim()) return
    await signal('chat', null, { name, text: draft.trim(), time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) })
    setMessages((current) => [...current, { name: 'Bạn', text: draft.trim(), time: 'Bây giờ' }])
    setDraft('')
  }

  if (!joined) return <main className="join-screen"><div className="join-card"><div className="brand"><span className="brand-mark"><span /></span><span>Luma</span></div><h1>Tham gia cuộc gọi</h1><p>Nhập tên và mã phòng để bắt đầu gọi video với người khác.</p><form onSubmit={joinRoom}><label>Tên của bạn<input value={name} onChange={(event) => setName(event.target.value)} required /></label><label>Mã phòng<input value={roomId} onChange={(event) => setRoomId(event.target.value)} required /></label>{error && <div className="error">{error}</div>}<button className="join-button" type="submit">Tham gia phòng</button></form><small>Camera và micro chỉ được sử dụng sau khi bạn bấm tham gia.</small></div></main>

  return <main className="app-shell">
    <header className="topbar"><div className="brand"><span className="brand-mark"><span /></span><span>Luma</span></div><div className="room-info"><div className="room-title">Phòng {roomId} <span className="live-dot" /> <span className="recording">Đang gọi</span></div><button className="room-id" onClick={() => navigator.clipboard?.writeText(roomId)}>{roomId} <Icon name="copy" size={14} /></button></div><div className="top-actions"><div className="profile-avatar">{name.slice(0, 2).toUpperCase()}</div></div></header>
    <div className="workspace"><section className={`call-area ${chatOpen ? '' : 'wide'}`}><div className="video-grid"><div className="video-tile main-video live-local"><video ref={localVideoRef} autoPlay muted playsInline /><div className="tile-label">{name} <span className="you-label">Bạn</span></div></div>{remoteParticipants.map((participant) => <RemoteVideo participant={participant} key={participant.id} />)}{remoteParticipants.length === 0 && <div className="waiting-tile"><div className="waiting-icon">◌</div><b>Đang chờ người tham gia</b><span>Chia sẻ mã phòng <strong>{roomId}</strong> để bắt đầu cuộc gọi</span></div>}</div><div className="call-footer"><div className="call-time"><span className="time-dot" /> Đã kết nối</div><div className="controls"><button className={`control-btn ${!micOn ? 'off' : ''}`} onClick={toggleMic}><Icon name={micOn ? 'mic' : 'micOff'} /><span>{micOn ? 'Tắt mic' : 'Bật mic'}</span></button><button className={`control-btn ${!cameraOn ? 'off' : ''}`} onClick={toggleCamera}><Icon name={cameraOn ? 'video' : 'videoOff'} /><span>{cameraOn ? 'Tắt camera' : 'Bật camera'}</span></button><button className="control-btn" onClick={() => setError('Chia sẻ màn hình sẽ được bổ sung trong phiên bản tiếp theo.')}><Icon name="screen" /><span>Chia sẻ</span></button><button className={`control-btn ${chatOpen ? 'active' : ''}`} onClick={() => setChatOpen(!chatOpen)}><Icon name="message" /><span>Trò chuyện</span></button></div><button className="end-call" onClick={() => window.location.reload()}><Icon name="phone" size={19} /><span>Rời phòng</span></button></div>{error && <div className="call-error">{error}</div>}</section>{chatOpen && <aside className="chat-panel"><div className="chat-header"><div><h2>Trò chuyện</h2><p>{remoteParticipants.length + 1} người trong phòng</p></div><button className="close-chat" onClick={() => setChatOpen(false)}><Icon name="x" size={18} /></button></div><div className="chat-messages">{messages.map((message, index) => <div className="message" key={`${message.time}-${index}`}><div className="message-meta"><span>{message.name}</span><time>{message.time}</time></div><p>{message.text}</p></div>)}</div><form className="message-form" onSubmit={sendMessage}><input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Viết tin nhắn..." /><button type="submit" aria-label="Gửi tin nhắn"><Icon name="send" size={17} /></button></form><p className="chat-note">Tin nhắn chỉ hiển thị trong cuộc gọi này</p></aside>}</div>
  </main>
}
