import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function getRedis() {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    throw new Error('Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN')
  }
  return Redis.fromEnv()
}

function roomKey(roomId) {
  return `luma:signal:${roomId}`
}

export async function POST(request) {
  try {
    const body = await request.json()
    if (!body.roomId || !body.from || !body.type) {
      return NextResponse.json({ error: 'Invalid signal' }, { status: 400 })
    }

    const message = {
      id: Date.now() * 1000 + Math.floor(Math.random() * 1000),
      from: body.from,
      to: body.to || null,
      type: body.type,
      payload: body.payload || null,
    }
    const redis = getRedis()
    const key = roomKey(body.roomId)
    await redis.rpush(key, message)
    await redis.expire(key, 60 * 60)
    return NextResponse.json({ ok: true, id: message.id })
  } catch (error) {
    console.error('Signal POST failed:', error)
    return NextResponse.json({ error: 'Signaling service unavailable' }, { status: 503 })
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const roomId = searchParams.get('roomId')
    const peerId = searchParams.get('peerId')
    const after = Number(searchParams.get('after') || 0)
    if (!roomId || !peerId || !Number.isFinite(after)) {
      return NextResponse.json({ error: 'Missing or invalid room parameters' }, { status: 400 })
    }

    const redis = getRedis()
    const storedMessages = await redis.lrange(roomKey(roomId), 0, -1)
    const messages = storedMessages.filter((message) => (
      message.id > after &&
      message.from !== peerId &&
      (!message.to || message.to === peerId)
    ))
    return NextResponse.json({ messages })
  } catch (error) {
    console.error('Signal GET failed:', error)
    return NextResponse.json({ error: 'Signaling service unavailable' }, { status: 503 })
  }
}
