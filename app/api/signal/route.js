import { NextResponse } from 'next/server'

const rooms = globalThis.__lumaSignalRooms || new Map()
globalThis.__lumaSignalRooms = rooms

export async function POST(request) {
  const body = await request.json()
  if (!body.roomId || !body.from || !body.type) return NextResponse.json({ error: 'Invalid signal' }, { status: 400 })
  const messages = rooms.get(body.roomId) || []
  messages.push({ id: Date.now() + Math.random(), from: body.from, to: body.to || null, type: body.type, payload: body.payload || null })
  rooms.set(body.roomId, messages.slice(-500))
  return NextResponse.json({ ok: true })
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const roomId = searchParams.get('roomId')
  const peerId = searchParams.get('peerId')
  const after = Number(searchParams.get('after') || 0)
  if (!roomId || !peerId) return NextResponse.json({ error: 'Missing room or peer' }, { status: 400 })
  const messages = (rooms.get(roomId) || []).filter((message) => message.id > after && message.from !== peerId && (!message.to || message.to === peerId))
  return NextResponse.json({ messages })
}
