"use client";

import React, { useMemo, useState } from "react";
import { Copy, Plus, Trash2, MessageSquare, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const PRACTITIONERS = [
  "Peter",
  "Liann",
  "Mindy",
  "Tiffany",
  "Rebecca",
  "Stephanie",
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
      "https://assets.cdn.filesafe.space/ojs3QKQJqLYRU35DWKJB/media/6a0b964bcbda603d33054172.jpg",
  },
  "Suite #4": {
    mapUrl: "https://maps.app.goo.gl/WdBahdRetmdExWwT6",
    directions:
      "Suite #4 is located farther into the parking lot. Please look for the Suite #4 entrance shown in the attached photo.",
    imageLabel: "Front of Suite #4",
    imageUrl:
      "https://assets.cdn.filesafe.space/ojs3QKQJqLYRU35DWKJB/media/6a0b964b36ce1b3e87ab27ad.jpg",
  },
};

type Appointment = {
  clientName: string;
  practitioner: string;
  suite: string;
  time: string;
};

const blankAppointment: Appointment = {
  clientName: "",
  practitioner: "Peter",
  suite: "Suite #1",
  time: "",
};

function generateText(
  appointment: Appointment,
  suiteInfo: {
    mapUrl: string;
    directions: string;
    imageLabel: string;
    imageUrl: string;
  }
) {
  const client = appointment.clientName.trim() || "Client";
  const practitioner = appointment.practitioner || "your practitioner";
  const suite = appointment.suite;
  const map = suiteInfo.mapUrl ? ` ${suiteInfo.mapUrl}` : "";
  const directions = suiteInfo.directions ? ` ${suiteInfo.directions}` : "";
  const timeText = appointment.time ? ` for your ${appointment.time} session` : "";

  return `Good Morning ${client}, EN Spa here - just to clarify (the auto text might be a little confusing), your session today${timeText} with ${practitioner} is in ${suite}.${map}${directions} Thank you - we’ll see you soon!`;
}

export default function EnSpaDailyClientTextGenerator() {
  const [appointments, setAppointments] = useState<Appointment[]>([
    {
      clientName: "Matthew",
      practitioner: "Rebecca",
      suite: "Suite #1",
      time: "",
    },
  ]);

  const [suiteInfo] = useState<Record<string, typeof DEFAULT_SUITES[string]>>(
    DEFAULT_SUITES
  );
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedImageIndex, setCopiedImageIndex] = useState<number | null>(null);

  const suites = Object.keys(suiteInfo);

  const generated = useMemo(
    () =>
      appointments.map((appt) =>
        generateText(appt, suiteInfo[appt.suite] || suiteInfo["Suite #1"])
      ),
    [appointments, suiteInfo]
  );

  function updateAppointment(index: number, field: keyof Appointment, value: string) {
    setAppointments((items) =>
      items.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  }

  function addAppointment() {
    setAppointments((items) => [...items, { ...blankAppointment }]);
  }

  function removeAppointment(index: number) {
    setAppointments((items) => items.filter((_, i) => i !== index));
  }

  async function copyText(text: string, index: number) {
    await navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 1400);
  }

  async function copyImageLink(imageUrl: string, index: number) {
    await navigator.clipboard.writeText(imageUrl);
    setCopiedImageIndex(index);
    setTimeout(() => setCopiedImageIndex(null), 1400);
  }

  return (
    <div className="min-h-screen bg-stone-50 p-4 text-stone-900 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="rounded-3xl bg-white p-6 shadow-sm md:p-8">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-wide text-stone-500">
                EN Spa Operations
              </p>
              <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
                Daily Client Text Generator
              </h1>
              <p className="mt-2 max-w-2xl text-stone-600">
                Add each scheduled client, choose the practitioner and suite, then copy the personalized message and attach the matching suite image.
              </p>
            </div>
            <Button onClick={addAppointment} className="rounded-2xl">
              <Plus className="mr-2 h-4 w-4" /> Add Client
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          {appointments.map((appointment, index) => {
            const text = generated[index];
            const suite = suiteInfo[appointment.suite] || suiteInfo["Suite #1"];

            return (
              <Card key={index} className="rounded-3xl border-stone-200 shadow-sm">
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

                  <div className="grid gap-3 md:grid-cols-4">
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
                      <span className="text-sm font-medium text-stone-600">Practitioner</span>
                      <select
                        value={appointment.practitioner}
                        onChange={(e) =>
                          updateAppointment(index, "practitioner", e.target.value)
                        }
                        className="w-full rounded-2xl border border-stone-200 bg-white px-3 py-2 outline-none focus:border-stone-500"
                      >
                        {PRACTITIONERS.map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="space-y-1 md:col-span-1">
                      <span className="text-sm font-medium text-stone-600">Suite</span>
                      <select
                        value={appointment.suite}
                        onChange={(e) =>
                          updateAppointment(index, "suite", e.target.value)
                        }
                        className="w-full rounded-2xl border border-stone-200 bg-white px-3 py-2 outline-none focus:border-stone-500"
                      >
                        {suites.map((suiteName) => (
                          <option key={suiteName} value={suiteName}>
                            {suiteName}
                          </option>
                        ))}
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
                          onClick={() => copyImageLink(suite.imageUrl, index)}
                          className="rounded-2xl"
                        >
                          <ImageIcon className="mr-2 h-4 w-4" />
                          {copiedImageIndex === index ? "Image Link Copied" : "Copy Image Link"}
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
