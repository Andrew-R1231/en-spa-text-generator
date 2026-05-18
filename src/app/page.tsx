"use client";

import React, { useMemo, useState } from "react";
import { Copy, Plus, Trash2, MessageSquare, Settings, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const DEFAULT_SUITES = {
  "Suite #1": {
    mapUrl: "https://maps.app.goo.gl/WdBahdRetmdExWwT6",
    directions:
      "It's the first Suite, closest to 41st St as you enter the parking lot.",
    imageLabel: "Front of Suite #1",
    imageUrl: "",
  },
  "Suite #2": {
    mapUrl: "",
    directions: "",
    imageLabel: "Front of Suite #2",
    imageUrl: "",
  },
  "Suite #3": {
    mapUrl: "",
    directions: "",
    imageLabel: "Front of Suite #3",
    imageUrl: "",
  },
};

const blankAppointment = {
  clientName: "",
  practitioners: "",
  suite: "Suite #1",
  time: "",
};

function formatPractitioners(value: string) {
  const names = value
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);

  if (names.length === 0) return "your practitioner";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

function generateText(appointment: any, suiteInfo: any) {
  const client = appointment.clientName.trim() || "Client";
  const practitionerText = formatPractitioners(appointment.practitioners);
  const suite = appointment.suite;
  const map = suiteInfo.mapUrl ? ` ${suiteInfo.mapUrl}` : "";
  const directions = suiteInfo.directions ? ` ${suiteInfo.directions}` : "";
  const timeText = appointment.time ? ` for your ${appointment.time} session` : "";

  return `Good Morning ${client}, EN Spa here - just to clarify (the auto text might be a little confusing), your session today${timeText} with ${practitionerText} is in ${suite}.${map}${directions} Thank you - we’ll see you soon!`;
}

export default function EnSpaDailyClientTextGenerator() {
  const [appointments, setAppointments] = useState([
    {
      clientName: "Matthew",
      practitioners: "Rebecca",
      suite: "Suite #1",
      time: "",
    },
  ]);
  const [suiteInfo, setSuiteInfo] = useState<Record<string, any>>(DEFAULT_SUITES);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const suites = Object.keys(suiteInfo);

  const generated = useMemo(
    () => appointments.map((appt) => generateText(appt, suiteInfo[appt.suite] || {})),
    [appointments, suiteInfo]
  );

  function updateAppointment(index: number, field: string, value: string) {
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

  function updateSuite(suite: string, field: string, value: string) {
    setSuiteInfo((current) => ({
      ...current,
      [suite]: {
        ...current[suite],
        [field]: value,
      },
    }));
  }

  async function copyText(text: string, index: number) {
    await navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 1400);
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
                Add each scheduled client, choose the suite, enter practitioner name(s), then copy the personalized message for texting.
              </p>
            </div>
            <Button onClick={addAppointment} className="rounded-2xl">
              <Plus className="mr-2 h-4 w-4" /> Add Client
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.4fr_0.9fr]">
          <div className="space-y-4">
            {appointments.map((appointment, index) => {
              const text = generated[index];
              const suite = suiteInfo[appointment.suite] || {};

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
                          onChange={(e) => updateAppointment(index, "clientName", e.target.value)}
                          placeholder="Matthew"
                          className="w-full rounded-2xl border border-stone-200 bg-white px-3 py-2 outline-none focus:border-stone-500"
                        />
                      </label>

                      <label className="space-y-1 md:col-span-1">
                        <span className="text-sm font-medium text-stone-600">Practitioner(s)</span>
                        <input
                          value={appointment.practitioners}
                          onChange={(e) => updateAppointment(index, "practitioners", e.target.value)}
                          placeholder="Rebecca, Mindy"
                          className="w-full rounded-2xl border border-stone-200 bg-white px-3 py-2 outline-none focus:border-stone-500"
                        />
                      </label>

                      <label className="space-y-1 md:col-span-1">
                        <span className="text-sm font-medium text-stone-600">Suite</span>
                        <select
                          value={appointment.suite}
                          onChange={(e) => updateAppointment(index, "suite", e.target.value)}
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
                      <p className="whitespace-pre-wrap text-sm leading-6 text-stone-800">{text}</p>
                    </div>

                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div className="flex items-center gap-2 text-sm text-stone-600">
                        <ImageIcon className="h-4 w-4" />
                        <span>Attach image: {suite.imageLabel || appointment.suite}</span>
                      </div>
                      <Button onClick={() => copyText(text, index)} className="rounded-2xl">
                        <Copy className="mr-2 h-4 w-4" />
                        {copiedIndex === index ? "Copied" : "Copy Text"}
                      </Button>
                    </div>

                    {suite.imageUrl && (
                      <img
                        src={suite.imageUrl}
                        alt={suite.imageLabel || appointment.suite}
                        className="max-h-56 rounded-2xl border border-stone-200 object-cover"
                      />
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Card className="h-fit rounded-3xl border-stone-200 shadow-sm">
            <CardContent className="space-y-5 p-5">
              <div className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-stone-500" />
                <h2 className="text-lg font-semibold">Suite Settings</h2>
              </div>
              <p className="text-sm text-stone-600">
                Save the permanent directions, map link, and optional image URL for each suite. These are used automatically in every generated message.
              </p>

              {suites.map((suiteName) => (
                <div key={suiteName} className="space-y-3 rounded-2xl border border-stone-200 p-4">
                  <h3 className="font-semibold">{suiteName}</h3>
                  <label className="block space-y-1">
                    <span className="text-sm font-medium text-stone-600">Map link</span>
                    <input
                      value={suiteInfo[suiteName].mapUrl}
                      onChange={(e) => updateSuite(suiteName, "mapUrl", e.target.value)}
                      placeholder="https://maps.app.goo.gl/..."
                      className="w-full rounded-2xl border border-stone-200 bg-white px-3 py-2 text-sm outline-none focus:border-stone-500"
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-sm font-medium text-stone-600">Directions</span>
                    <textarea
                      value={suiteInfo[suiteName].directions}
                      onChange={(e) => updateSuite(suiteName, "directions", e.target.value)}
                      placeholder="Client-facing directions for this suite"
                      className="min-h-20 w-full rounded-2xl border border-stone-200 bg-white px-3 py-2 text-sm outline-none focus:border-stone-500"
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-sm font-medium text-stone-600">Image URL optional</span>
                    <input
                      value={suiteInfo[suiteName].imageUrl}
                      onChange={(e) => updateSuite(suiteName, "imageUrl", e.target.value)}
                      placeholder="Paste hosted image link"
                      className="w-full rounded-2xl border border-stone-200 bg-white px-3 py-2 text-sm outline-none focus:border-stone-500"
                    />
                  </label>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}