"use client";

import React, { useMemo, useState } from "react";
import {
  CalendarDays,
  Copy,
  LogOut,
  Plus,
  RefreshCw,
  Trash2,
  MessageSquare,
  Image as ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const PRACTITIONERS = [
  "Peter",
  "Liann",
  "Mindy",
  "Tiffany",
  "Rebecca",
  "Stephanie",
  "Mina",
  "Meghan",
];

const DEFAULT_SUITES: Record<
  string,
  {
    mapUrl: string;
    directions: string;
    imageLabel: string;
    imageUrl: string;
  }
> = {
  "Suite #1": {
    mapUrl: "https://maps.app.goo.gl/WdBahdRetmdExWwT6",
    directions:
      "It's the first Suite, closest to 41st St as you enter the parking lot.",
    imageLabel: "Front of Suite #1",
    imageUrl:
      "https://assets.cdn.filesafe.space/ojs3QKQJqLYRU35DWKJB/media/6a0bb6cb60b3f1e04ab72d4e.png",
  },
  "Suite #4": {
    mapUrl: "https://maps.app.goo.gl/WdBahdRetmdExWwT6",
    directions:
      "The door to Suite #4 is located farther into the parking lot, (it has an EN SPA sign on it), and come up the stairs - it's the door to your right, at the top.",
    imageLabel: "Front of Suite #4",
    imageUrl:
      "https://assets.cdn.filesafe.space/ojs3QKQJqLYRU35DWKJB/media/6a0bb6cb36ce1b3e87af3d81.png",
  },
};

type ClientType = "New Client" | "Returning Client";
type AppointmentType = "Standard" | "Couples Massage";

type Appointment = {
  appointmentId?: string;
  clientName: string;
  mobilePhone: string;
  clientType: ClientType;
  appointmentType: AppointmentType;
  greetingTime: "Morning" | "Afternoon" | "Hi";
  practitioner: string;
  secondPractitioner: string;
  suite: string;
  time: string;
  serviceSummary: string;
};

const blankAppointment: Appointment = {
  clientName: "",
  mobilePhone: "",
  clientType: "New Client",
  appointmentType: "Standard",
  greetingTime: "Morning",
  practitioner: "Peter",
  secondPractitioner: "Liann",
  suite: "Suite #1",
  time: "",
  serviceSummary: "",
};

type BoulevardImportResponse = {
  date: string;
  locationName: string;
  timeZone: string;
  appointments: Appointment[];
  error?: string;
};

function todayInBoise() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Boise",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function formatPractitioners(appointment: Appointment) {
  if (appointment.appointmentType === "Couples Massage") {
    const first = appointment.practitioner || "your first practitioner";
    const second = appointment.secondPractitioner || "your second practitioner";
    return `${first} and ${second}`;
  }

  return appointment.practitioner || "your practitioner";
}

function generateText(
  appointment: Appointment,
  suiteInfo: {
    mapUrl: string;
    directions: string;
    imageLabel: string;
    imageUrl: string;
  }
) {
  const greeting =
    appointment.greetingTime === "Hi"
      ? "Hi"
      : appointment.greetingTime === "Afternoon"
        ? "Good Afternoon"
        : "Good Morning";
  const client = appointment.clientName.trim() || "Client";
  const practitionerText = formatPractitioners(appointment);
  const suite = appointment.suite;
  const map = suiteInfo.mapUrl ? ` ${suiteInfo.mapUrl}` : "";
  const directions = suiteInfo.directions ? ` ${suiteInfo.directions}` : "";
  const timeText = appointment.time ? ` at ${appointment.time}` : "";

  if (appointment.appointmentType === "Couples Massage") {
    if (appointment.clientType === "Returning Client") {
      return `${greeting} ${client}, EN Spa here - your couples massage today${timeText} with ${practitionerText} is in ${suite}. ${map} Thank you - we’ll see you soon!`;
    }

    return `${greeting} ${client}, EN Spa here - just to clarify (the auto text might be a little confusing), your couples massage today${timeText} with ${practitionerText} is in ${suite}.${map}${directions} Thank you - we’ll see you soon!`;
  }

  if (appointment.clientType === "Returning Client") {
    return `${greeting} ${client}, EN Spa here - your session today${timeText} with ${practitionerText} is in ${suite}. ${map} Thank you - we’ll see you soon!`;
  }

  return `${greeting} ${client}, EN Spa here - just to clarify (the auto text might be a little confusing), your session today${timeText} with ${practitionerText} is in ${suite}.${map}${directions} Thank you - we’ll see you soon!`;
}

export default function EnSpaDailyClientTextGenerator() {
  const [appointments, setAppointments] = useState<Appointment[]>([
    {
      clientName: "Matthew",
      mobilePhone: "",
      clientType: "New Client",
      appointmentType: "Standard",
      greetingTime: "Morning",
      practitioner: "Rebecca",
      secondPractitioner: "Peter",
      suite: "Suite #1",
      time: "",
      serviceSummary: "",
    },
  ]);

  const [suiteInfo] = useState<Record<string, typeof DEFAULT_SUITES[string]>>(
    DEFAULT_SUITES
  );
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedPhoneIndex, setCopiedPhoneIndex] = useState<number | null>(null);
  const [copiedImageIndex, setCopiedImageIndex] = useState<number | null>(null);
  const [importDate, setImportDate] = useState(todayInBoise);
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState("");
  const [importError, setImportError] = useState("");

  const suites = Object.keys(suiteInfo);

  const generated = useMemo(
    () =>
      appointments.map((appt) => {
        const suiteName = appt.suite;
        return generateText(appt, suiteInfo[suiteName] || suiteInfo["Suite #1"]);
      }),
    [appointments, suiteInfo]
  );

  function updateAppointment(index: number, field: keyof Appointment, value: string) {
    setAppointments((items) =>
      items.map((item, i) => {
        if (i !== index) return item;
        return { ...item, [field]: value };
      })
    );
  }

  function addAppointment() {
    setAppointments((items) => [...items, { ...blankAppointment }]);
  }

  function removeAppointment(index: number) {
    setAppointments((items) => items.filter((_, i) => i !== index));
  }

  async function importBoulevardDay() {
    setImporting(true);
    setImportMessage("");
    setImportError("");

    try {
      const response = await fetch(
        `/api/boulevard/appointments?date=${encodeURIComponent(importDate)}`,
        { cache: "no-store" },
      );
      const result = (await response.json()) as BoulevardImportResponse;

      if (response.status === 401) {
        window.location.replace("/login");
        return;
      }
      if (!response.ok) {
        setImportError(result.error || "Unable to import Boulevard appointments.");
        return;
      }

      setAppointments(result.appointments);
      setImportMessage(
        result.appointments.length === 1
          ? `Imported 1 appointment from ${result.locationName}.`
          : `Imported ${result.appointments.length} appointments from ${result.locationName}.`,
      );
    } catch {
      setImportError("Unable to reach Boulevard. Please try again.");
    } finally {
      setImporting(false);
    }
  }

  async function copyText(text: string, index: number) {
    await navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 1400);
  }

  async function copyPhoneNumber(phoneNumber: string, index: number) {
    await navigator.clipboard.writeText(phoneNumber);
    setCopiedPhoneIndex(index);
    setTimeout(() => setCopiedPhoneIndex(null), 1400);
  }

  async function copyImage(imageUrl: string, index: number) {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();

      await navigator.clipboard.write([
        new ClipboardItem({
          [blob.type]: blob,
        }),
      ]);

      setCopiedImageIndex(index);
      setTimeout(() => setCopiedImageIndex(null), 1400);
    } catch (error) {
      console.error("Failed to copy image:", error);
      alert(
        "The image could not be copied directly. Try opening the image, right-clicking it, and choosing Copy Image."
      );
    }
  }

  return (
    <div className="min-h-screen bg-stone-50 p-4 text-stone-900 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="rounded-3xl bg-white p-6 shadow-sm md:p-8">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-wide text-stone-500">
                EN Spa Operations
              </p>
              <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
                Daily Client Text Generator
              </h1>
              <p className="mt-2 max-w-2xl text-stone-600">
                Add each scheduled client, choose the client type, appointment type, practitioner, and suite, then copy the personalized message and matching suite image.
              </p>
            </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={addAppointment} className="rounded-2xl">
                  <Plus className="mr-2 h-4 w-4" /> Add Client
                </Button>
                <form action="/api/auth/logout" method="post">
                  <Button type="submit" variant="outline" className="rounded-2xl">
                    <LogOut className="mr-2 h-4 w-4" /> Sign out
                  </Button>
                </form>
              </div>
            </div>

            <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <label className="space-y-1">
                  <span className="flex items-center gap-2 text-sm font-medium text-stone-700">
                    <CalendarDays className="h-4 w-4" />
                    Boulevard calendar date
                  </span>
                  <input
                    type="date"
                    value={importDate}
                    onChange={(event) => setImportDate(event.target.value)}
                    className="rounded-2xl border border-stone-200 bg-white px-3 py-2 outline-none focus:border-stone-500"
                  />
                </label>
                <Button
                  type="button"
                  variant="outline"
                  onClick={importBoulevardDay}
                  disabled={importing || !importDate}
                  className="rounded-2xl"
                >
                  <RefreshCw
                    className={`mr-2 h-4 w-4 ${importing ? "animate-spin" : ""}`}
                  />
                  {importing ? "Importing…" : "Import Boulevard Day"}
                </Button>
              </div>
              {importMessage && (
                <p className="mt-3 text-sm text-emerald-700">{importMessage}</p>
              )}
              {importError && (
                <p role="alert" className="mt-3 text-sm text-red-700">
                  {importError}
                </p>
              )}
              <p className="mt-2 text-xs text-stone-500">
                Importing replaces the cards below. You can still edit every
                imported field before copying a message.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {appointments.length === 0 && (
            <Card className="rounded-3xl border-stone-200 shadow-sm">
              <CardContent className="p-8 text-center text-stone-600">
                No active Boulevard appointments were found for this date.
              </CardContent>
            </Card>
          )}
          {appointments.map((appointment, index) => {
            const text = generated[index];
            const suiteName = appointment.suite;
            const suite = suiteInfo[suiteName] || suiteInfo["Suite #1"];
            const isCouplesMassage = appointment.appointmentType === "Couples Massage";

            return (
              <Card
                key={appointment.appointmentId || index}
                className="rounded-3xl border-stone-200 shadow-sm"
              >
                <CardContent className="space-y-4 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-5 w-5 text-stone-500" />
                      <h2 className="text-lg font-semibold">Client #{index + 1}</h2>
                    </div>
                    {appointments.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeAppointment(index)}
                        className="rounded-xl text-stone-500 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  {(appointment.mobilePhone || appointment.serviceSummary) && (
                    <div className="flex flex-col gap-1 rounded-2xl bg-stone-50 px-4 py-3 text-sm text-stone-600 sm:flex-row sm:items-center sm:justify-between">
                      <span>
                        {appointment.serviceSummary || "Boulevard appointment"}
                      </span>
                      {appointment.mobilePhone && (
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-stone-900">
                            {appointment.mobilePhone}
                          </span>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              copyPhoneNumber(appointment.mobilePhone, index)
                            }
                            className="h-8 rounded-xl"
                          >
                            <Copy className="mr-1.5 h-3.5 w-3.5" />
                            {copiedPhoneIndex === index ? "Copied" : "Copy Number"}
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="grid gap-3 md:grid-cols-5">
                    <label className="space-y-1 md:col-span-1">
                      <span className="text-sm font-medium text-stone-600">Client name</span>
                      <input
                        value={appointment.clientName}
                        onChange={(e) =>
                          updateAppointment(index, "clientName", e.target.value)
                        }
                        placeholder="Matthew"
                        className="w-full rounded-2xl border border-stone-200 bg-white px-3 py-2 outline-none focus:border-stone-500"
                      />
                    </label>

                    <label className="space-y-1 md:col-span-1">
                      <span className="text-sm font-medium text-stone-600">Client type</span>
                      <select
                        value={appointment.clientType}
                        onChange={(e) =>
                          updateAppointment(index, "clientType", e.target.value)
                        }
                        className="w-full rounded-2xl border border-stone-200 bg-white px-3 py-2 outline-none focus:border-stone-500"
                      >
                        <option value="New Client">New Client</option>
                        <option value="Returning Client">Returning Client</option>
                      </select>
                    </label>

                    <label className="space-y-1 md:col-span-1">
                      <span className="text-sm font-medium text-stone-600">Appointment type</span>
                      <select
                        value={appointment.appointmentType}
                        onChange={(e) =>
                          updateAppointment(index, "appointmentType", e.target.value)
                        }
                        className="w-full rounded-2xl border border-stone-200 bg-white px-3 py-2 outline-none focus:border-stone-500"
                      >
                        <option value="Standard">Standard</option>
                        <option value="Couples Massage">Couples Massage</option>
                      </select>
                    </label>
                    <label className="space-y-1 md:col-span-1">
                      <span className="text-sm font-medium text-stone-600">Greeting</span>
                      <select
                        value={appointment.greetingTime}
                        onChange={(e) =>
                          updateAppointment(index, "greetingTime", e.target.value)
                        }
                        className="w-full rounded-2xl border border-stone-200 bg-white px-3 py-2 outline-none focus:border-stone-500"
                      >
                        <option value="Morning">Morning</option>
                        <option value="Afternoon">Afternoon</option>
                        <option value="Hi">Hi</option>
                      </select>
                    </label>

                    <label className="space-y-1 md:col-span-1">
                      <span className="text-sm font-medium text-stone-600">Time optional</span>
                      <input
                        value={appointment.time}
                        onChange={(e) => updateAppointment(index, "time", e.target.value)}
                        placeholder="10:30 AM"
                        className="w-full rounded-2xl border border-stone-200 bg-white px-3 py-2 outline-none focus:border-stone-500"
                      />
                    </label>
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    <label className="space-y-1 md:col-span-1">
                      <span className="text-sm font-medium text-stone-600">
                        {isCouplesMassage ? "Practitioner 1" : "Practitioner"}
                      </span>
                      <select
                        value={appointment.practitioner}
                        onChange={(e) =>
                          updateAppointment(index, "practitioner", e.target.value)
                        }
                        className="w-full rounded-2xl border border-stone-200 bg-white px-3 py-2 outline-none focus:border-stone-500"
                      >
                        {Array.from(
                          new Set([...PRACTITIONERS, appointment.practitioner].filter(Boolean)),
                        ).map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </label>

                    {isCouplesMassage && (
                      <label className="space-y-1 md:col-span-1">
                        <span className="text-sm font-medium text-stone-600">
                          Practitioner 2
                        </span>
                        <select
                          value={appointment.secondPractitioner}
                          onChange={(e) =>
                            updateAppointment(index, "secondPractitioner", e.target.value)
                          }
                          className="w-full rounded-2xl border border-stone-200 bg-white px-3 py-2 outline-none focus:border-stone-500"
                        >
                          {Array.from(
                            new Set(
                              [
                                ...PRACTITIONERS,
                                appointment.secondPractitioner,
                              ].filter(Boolean),
                            ),
                          ).map((name) => (
                            <option key={name} value={name}>
                              {name}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}

                    <label className="space-y-1 md:col-span-1">
                      <span className="text-sm font-medium text-stone-600">Suite</span>
                      <select
                        value={suiteName}
                        onChange={(e) => updateAppointment(index, "suite", e.target.value)}
                        className="w-full rounded-2xl border border-stone-200 bg-white px-3 py-2 outline-none focus:border-stone-500"
                      >
                        {suites.map((suiteOption) => (
                          <option key={suiteOption} value={suiteOption}>
                            {suiteOption}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="rounded-2xl bg-stone-100 p-4">
                    <p className="whitespace-pre-wrap text-sm leading-6 text-stone-800">
                      {text}
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-[220px_1fr] md:items-center">
                    <img
                      src={suite.imageUrl}
                      alt={suite.imageLabel}
                      className="h-40 w-full rounded-2xl border border-stone-200 object-cover"
                    />

                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div className="flex items-center gap-2 text-sm text-stone-600">
                        <ImageIcon className="h-4 w-4" />
                        <span>Attach image: {suite.imageLabel}</span>
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <Button onClick={() => copyText(text, index)} className="rounded-2xl">
                          <Copy className="mr-2 h-4 w-4" />
                          {copiedIndex === index ? "Copied" : "Copy Text"}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => copyImage(suite.imageUrl, index)}
                          className="rounded-2xl"
                        >
                          <ImageIcon className="mr-2 h-4 w-4" />
                          {copiedImageIndex === index ? "Image Copied" : "Copy Image"}
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
