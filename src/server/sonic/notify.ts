// src/server/sonic/notify.ts
// SONIC — Structured Output Notification and Interaction Channel

import { db } from "../db"
import { NotificationType } from "@prisma/client"

interface NotificationData {
  refId?: string
  badge?: string
  giftAmount?: number
  eventTitle?: string
  senderName?: string
  [key: string]: unknown
}

const TEMPLATES: Record<
  NotificationType,
  {
    en: { title: string; body: (d: NotificationData) => string; subject?: string }
    es: { title: string; body: (d: NotificationData) => string; subject?: string }
    email: boolean
  }
> = {
  GIFT_RECEIVED: {
    en: {
      title: "You received a gift!",
      body: (d) => `${d.senderName ?? "Someone"} sent you ${d.giftAmount ?? "some"} credits`,
      subject: "You have a new gift on Mielesy",
    },
    es: {
      title: "¡Recibiste un regalo!",
      body: (d) => `${d.senderName ?? "Alguien"} te envió ${d.giftAmount ?? "algunos"} créditos`,
      subject: "Tienes un regalo nuevo en Mielesy",
    },
    email: true,
  },
  MESSAGE: {
    en: {
      title: "New message",
      body: (d) => `You have a new message from ${d.senderName ?? "a member"}`,
    },
    es: {
      title: "Nuevo mensaje",
      body: (d) => `Tienes un nuevo mensaje de ${d.senderName ?? "una miembra"}`,
    },
    email: false,
  },
  EVENT_REMINDER: {
    en: {
      title: "Event tomorrow",
      body: (d) => `${d.eventTitle ?? "Your event"} is coming up tomorrow!`,
      subject: "Your Mielesy event is tomorrow",
    },
    es: {
      title: "Evento mañana",
      body: (d) => `¡${d.eventTitle ?? "Tu evento"} es mañana!`,
      subject: "Tu evento en Mielesy es mañana",
    },
    email: true,
  },
  EVENT_INVITE: {
    en: {
      title: "You're invited!",
      body: (d) => `You've been invited to ${d.eventTitle ?? "an event"}`,
      subject: "You have a Mielesy event invitation",
    },
    es: {
      title: "¡Estás invitada!",
      body: (d) => `Te han invitado a ${d.eventTitle ?? "un evento"}`,
      subject: "Tienes una invitación de evento en Mielesy",
    },
    email: true,
  },
  TRUST_SCORE_CHANGE: {
    en: {
      title: "Trust badge updated",
      body: (d) => `Your trust badge is now: ${d.badge ?? "updated"}`,
      subject: "Your Mielesy trust badge changed",
    },
    es: {
      title: "Insignia actualizada",
      body: (d) => `Tu insignia de confianza es ahora: ${d.badge ?? "actualizada"}`,
      subject: "Tu insignia de Mielesy cambió",
    },
    email: true,
  },
  SYSTEM: {
    en: {
      title: "Notice from Mielesy",
      body: () => "You have a new notice from the Mielesy team",
      subject: "A message from Mielesy",
    },
    es: {
      title: "Aviso de Mielesy",
      body: () => "Tienes un aviso nuevo del equipo de Mielesy",
      subject: "Un mensaje de Mielesy",
    },
    email: true,
  },
}

export async function notify(
  userId: string,
  type: NotificationType,
  data: NotificationData = {}
) {
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { language: true, email: true },
  })

  const tmpl = TEMPLATES[type]

  await db.notification.create({
    data: {
      userId,
      type,
      title: tmpl.en.title,
      titleEs: tmpl.es.title,
      body: tmpl.en.body(data),
      bodyEs: tmpl.es.body(data),
      refId: data.refId,
    },
  })

  // Email (via Resend — wired in production)
  if (tmpl.email && tmpl.en.subject) {
    const lang = user.language === "es" ? "es" : "en"
    console.log(`[SONIC] Email to ${user.email}: ${tmpl[lang].subject}`)
    // await resend.emails.send({ ... })
  }
}

export async function getUnread(userId: string) {
  return db.notification.findMany({
    where: { userId, isRead: false },
    orderBy: { createdAt: "desc" },
    take: 20,
  })
}

export async function markRead(notificationId: string, userId: string) {
  return db.notification.update({
    where: { id: notificationId, userId },
    data: { isRead: true, readAt: new Date() },
  })
}
