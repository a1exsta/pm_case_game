import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { assessmentData, getQuestionScenario } from "../data/questions";
import { useAssessmentStore } from "../store/useStore";
import RadarChart from "./RadarChart";

type Question = (typeof assessmentData.questions)[number];

const roleLabels: Record<(typeof assessmentData.roles)[number], string> = {
  "Product Manager": "Продуктовый менеджер",
  "Project Manager": "Проектный менеджер",
};

const levelLabels: Record<(typeof assessmentData.levels)[number], string> = {
  Junior: "Junior",
  Middle: "Middle",
  Senior: "Senior",
};

const categoryLabels: Record<string, string> = {
  Prioritization: "Приоритизация",
  "Discovery & Analytics": "Дискавери и аналитика",
  "Product Strategy": "Продуктовая стратегия",
  "AI & Tech Context": "AI и технический контекст",
  "Risk Management": "Управление рисками",
  "Planning & Delivery": "Планирование и delivery",
  "Stakeholder Management": "Управление стейкхолдерами",
  "Process Optimization": "Оптимизация процессов",
};

const displayCategory = (category: string) => categoryLabels[category] ?? category;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

function downloadFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

const zoneLabel = (value: number) => {
  if (value > 80) return "Зеленая зона";
  if (value >= 50) return "Желтая зона";
  return "Красная зона";
};

const zoneColor = (value: number) => {
  if (value > 80) return "text-emerald-300";
  if (value >= 50) return "text-amber-300";
  return "text-rose-300";
};

function calculateResults(questions: Question[], answers: Record<string, number>) {
  const perCategory: Record<string, { score: number; max: number }> = {};

  for (const question of questions) {
    const chosenIndex = answers[question.id];
    const selectedPoints = typeof chosenIndex === "number" ? question.options[chosenIndex]?.points ?? 0 : 0;
    const maxPoints = Math.max(...question.options.map((opt) => opt.points));

    if (!perCategory[question.category]) {
      perCategory[question.category] = { score: 0, max: 0 };
    }

    perCategory[question.category].score += selectedPoints;
    perCategory[question.category].max += maxPoints;
  }

  const normalized = Object.entries(perCategory).map(([category, value]) => {
    const percent = value.max === 0 ? 0 : Math.round((value.score / value.max) * 100);
    return {
      category,
      percent,
      zone: zoneLabel(percent),
      recommendation:
        percent < 50
          ? assessmentData.recommendations[category as keyof typeof assessmentData.recommendations]?.low ?? "Сформируйте план развития этой категории."
          : assessmentData.recommendations[category as keyof typeof assessmentData.recommendations]?.high ?? "Категория в стабильном состоянии.",
    };
  });

  const sorted = [...normalized].sort((a, b) => b.percent - a.percent);
  const superpowers = sorted.filter((item) => item.percent > 80).slice(0, 2);
  const growthZones = [...normalized].filter((item) => item.percent <= 80).sort((a, b) => a.percent - b.percent);

  return {
    normalized,
    top2: superpowers,
    bottom2: growthZones,
  };
}

export default function Assessment() {
  const {
    selectedRole,
    selectedLevel,
    currentQuestionIndex,
    hasStarted,
    answers,
    setRole,
    setLevel,
    startAssessment,
    selectAnswer,
    nextQuestion,
    prevQuestion,
    resetAssessment,
  } = useAssessmentStore();

  const canStart = Boolean(selectedRole && selectedLevel);
  const filteredQuestions = assessmentData.questions.filter((item) => item.role === selectedRole && item.level === selectedLevel);
  const currentQuestion = filteredQuestions[currentQuestionIndex];
  const isCompleted = hasStarted && filteredQuestions.length > 0 && Object.keys(answers).length >= filteredQuestions.length;
  const selectedTrackLabel = selectedRole && selectedLevel ? `${roleLabels[selectedRole]} · ${levelLabels[selectedLevel]}` : "";

  const results = calculateResults(filteredQuestions, answers);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState("");
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const [lastCheckpointSeen, setLastCheckpointSeen] = useState(0);

  const chatSystemContext = useMemo(() => {
    if (!selectedTrackLabel) {
      return "Ты AI-наставник по управленческим кейсам. Давай короткие и практичные советы на русском языке.";
    }
    const resultSummary = results.normalized.map((item) => `${displayCategory(item.category)}: ${item.percent}% (${item.zone})`).join("; ");
    return `Ты AI-наставник по управленческим кейсам. Пользователь проходит трек "${selectedTrackLabel}". Его текущие результаты: ${resultSummary}. Отвечай на русском, структурно и практично.`;
  }, [selectedTrackLabel, results.normalized]);

  useEffect(() => {
    if (!chatScrollRef.current) return;
    chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
  }, [chatMessages, chatLoading]);

  useEffect(() => {
    if (isCompleted) return;
    setChatMessages([]);
    setChatInput("");
    setChatError("");
    setChatLoading(false);
  }, [isCompleted]);

  useEffect(() => {
    if (!hasStarted) {
      setLastCheckpointSeen(0);
    }
  }, [hasStarted, selectedRole, selectedLevel]);

  const exportAssessmentResults = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      track: selectedTrackLabel || "Не выбран",
      normalized: results.normalized.map((item) => ({
        category: displayCategory(item.category),
        percent: item.percent,
        zone: item.zone,
        recommendation: item.recommendation,
      })),
      superpowers: results.top2.map((item) => ({
        category: displayCategory(item.category),
        percent: item.percent,
      })),
      growthZones: results.bottom2.map((item) => ({
        category: displayCategory(item.category),
        percent: item.percent,
      })),
      answers: filteredQuestions.map((question) => {
        const selectedOptionIndex = answers[question.id];
        const selectedOption = typeof selectedOptionIndex === "number" ? question.options[selectedOptionIndex] : null;
        return {
          id: question.id,
          category: displayCategory(question.category),
          question: question.question,
          selectedOptionIndex,
          selectedOptionText: selectedOption?.text ?? null,
          selectedOptionPoints: selectedOption?.points ?? null,
          selectedOptionFeedback: selectedOption?.feedback ?? null,
        };
      }),
    };

    downloadFile(`assessment-results-${Date.now()}.json`, JSON.stringify(payload, null, 2), "application/json");
  };

  const exportChatDialog = () => {
    const header = `Диалог GigaChat\nТрек: ${selectedTrackLabel || "Не выбран"}\nЭкспорт: ${new Date().toLocaleString()}\n\n`;
    const body = chatMessages
      .map((message, index) => `${index + 1}. ${message.role === "assistant" ? "AI" : "Вы"}:\n${message.content}`)
      .join("\n\n---\n\n");

    downloadFile(`gigachat-dialog-${Date.now()}.txt`, `${header}${body}`, "text/plain;charset=utf-8");
  };

  const sendChatMessage = async () => {
    const userText = chatInput.trim();
    if (!userText || chatLoading) return;

    setChatError("");
    const nextMessages: ChatMessage[] = [...chatMessages, { role: "user", content: userText }];
    setChatMessages(nextMessages);
    setChatInput("");
    setChatLoading(true);

    try {
      const response = await fetch("/api/gigachat-chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          systemContext: chatSystemContext,
          messages: nextMessages.map((message) => ({ role: message.role, content: message.content })),
        }),
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null);
        const errorText = errorPayload?.error ?? "Ошибка запроса к прокси GigaChat.";
        throw new Error(`GigaChat API ${response.status}: ${String(errorText).slice(0, 220)}`);
      }

      const payload = await response.json();
      const assistantText = payload?.assistantText?.trim?.();
      if (!assistantText) {
        throw new Error("Пустой ответ от GigaChat.");
      }

      setChatMessages((prev) => [...prev, { role: "assistant", content: assistantText }]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Неизвестная ошибка запроса.";
      setChatError(message);
    } finally {
      setChatLoading(false);
    }
  };

  if (hasStarted && filteredQuestions.length === 0) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
        <main className="relative mx-auto flex min-h-screen max-w-2xl items-center px-4 py-12">
          <section className="w-full rounded-3xl border border-panelBorder bg-panel/90 p-8 text-center shadow-premium">
            <h1 className="text-2xl font-semibold">Для этого трека пока нет вопросов</h1>
            <p className="mt-3 text-slate-300">Для выбранных Role/Level пока нет контента в `questions.ts`.</p>
            <button
              type="button"
              onClick={resetAssessment}
              className="mt-6 rounded-xl border border-slate-600 px-5 py-2.5 text-sm font-semibold text-slate-200 hover:bg-slate-800"
            >
              Вернуться на старт
            </button>
          </section>
        </main>
      </div>
    );
  }

  if (isCompleted) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
        <div className="absolute left-0 top-0 h-72 w-72 rounded-full bg-indigo-500/20 blur-3xl" />
        <main className="relative mx-auto max-w-6xl px-4 py-10">
          <section className="rounded-3xl border border-panelBorder bg-panel/90 p-8 shadow-premium">
            <h1 className="text-3xl font-semibold">Панель результатов</h1>
            <p className="mt-2 text-slate-300">Нормализованные результаты по категориям и зоны развития.</p>
            {selectedTrackLabel ? <p className="mt-1 text-sm text-slate-400">Трек: {selectedTrackLabel}</p> : null}

            <div className="mt-8 grid gap-8 lg:grid-cols-2">
              <RadarChart data={results.normalized.map((item) => ({ category: displayCategory(item.category), value: item.percent }))} />
              <div className="space-y-4">
                <div className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
                  <h3 className="text-lg font-semibold text-emerald-200">Ваши суперсилы</h3>
                  {results.top2.length > 0 ? (
                    results.top2.map((item) => (
                      <p key={item.category} className="mt-2 text-sm text-slate-300">
                        <span className="font-medium text-white">{displayCategory(item.category)}</span>: {item.percent}%
                      </p>
                    ))
                  ) : (
                    <p className="mt-2 text-sm text-slate-400">Пока нет категорий в зеленой зоне. Продолжайте прокачку навыков.</p>
                  )}
                </div>
                <div className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
                  <h3 className="text-lg font-semibold text-rose-200">Зоны роста</h3>
                  {results.bottom2.map((item) => (
                    <p key={item.category} className="mt-2 text-sm text-slate-300">
                      <span className="font-medium text-white">{displayCategory(item.category)}</span>: {item.percent}%
                    </p>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-2">
              {results.normalized.map((item) => (
                <details key={item.category} className="rounded-xl border border-slate-700 bg-slate-900/70 p-4">
                  <summary className="cursor-pointer text-sm font-semibold">
                    {displayCategory(item.category)} - {item.percent}% <span className={zoneColor(item.percent)}>({item.zone})</span>
                  </summary>
                  <p className="mt-3 text-sm text-slate-300">{item.recommendation}</p>
                </details>
              ))}
            </div>

            <button
              type="button"
              onClick={resetAssessment}
              className="mt-8 rounded-xl border border-slate-600 px-5 py-2.5 text-sm font-semibold text-slate-200 hover:bg-slate-800"
            >
              Пройти заново
            </button>
            <button
              type="button"
              onClick={exportAssessmentResults}
              className="ml-3 mt-8 rounded-xl border border-cyan-500/60 bg-cyan-500/10 px-5 py-2.5 text-sm font-semibold text-cyan-200 hover:bg-cyan-500/20"
            >
              Выгрузить результаты теста
            </button>

            <section className="mt-8 rounded-2xl border border-slate-700 bg-slate-900/70 p-5">
              <h3 className="text-lg font-semibold text-cyan-200">Консультация AI-ассистента (GigaChat)</h3>
              <p className="mt-1 text-xs text-slate-400">Чат уже подключен. Просто задайте вопрос по своим результатам.</p>

              <div ref={chatScrollRef} className="mt-4 max-h-64 space-y-3 overflow-auto rounded-lg border border-slate-700 bg-slate-950/60 p-3">
                {chatMessages.length === 0 ? (
                  <p className="text-sm text-slate-500">Здесь появится диалог с AI-ассистентом.</p>
                ) : (
                  chatMessages.map((message, index) => (
                    <div
                      key={`chat-message-${index}`}
                      className={`rounded-lg border px-3 py-2 text-sm ${
                        message.role === "assistant"
                          ? "border-cyan-500/40 bg-cyan-500/10 text-slate-100"
                          : "border-indigo-500/40 bg-indigo-500/10 text-slate-100"
                      }`}
                    >
                      <p className="mb-1 text-xs uppercase tracking-wide text-slate-400">{message.role === "assistant" ? "AI" : "Вы"}</p>
                      {message.role === "assistant" ? (
                        <div className="prose prose-invert prose-sm max-w-none">
                          <ReactMarkdown>{message.content}</ReactMarkdown>
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap">{message.content}</p>
                      )}
                    </div>
                  ))
                )}
              </div>

              {chatError ? <p className="mt-3 text-sm text-rose-300">{chatError}</p> : null}

              <div className="mt-4 flex flex-col gap-3">
                <div className="flex items-center justify-end">
                  <button
                    type="button"
                    onClick={exportChatDialog}
                    disabled={chatMessages.length === 0}
                    className="rounded-lg border border-indigo-500/60 bg-indigo-500/10 px-4 py-2 text-sm font-semibold text-indigo-200 disabled:opacity-50"
                  >
                    Выгрузить диалог
                  </button>
                </div>
                <div className="flex flex-col gap-3 md:flex-row">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(event) => setChatInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      void sendChatMessage();
                    }
                  }}
                  placeholder="Спросите у ассистента, как улучшить ваши зоны роста..."
                  className="flex-1 rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400"
                />
                <button
                  type="button"
                  onClick={() => void sendChatMessage()}
                  disabled={chatLoading}
                  className="rounded-lg bg-gradient-to-r from-cyan-500 to-indigo-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {chatLoading ? "Отправка..." : "Спросить AI"}
                </button>
                </div>
              </div>
            </section>
          </section>
        </main>
      </div>
    );
  }

  if (hasStarted && filteredQuestions.length > 0 && currentQuestion) {
    const selectedOptionIndex = answers[currentQuestion.id];
    const selectedFeedback = typeof selectedOptionIndex === "number" ? currentQuestion.options[selectedOptionIndex]?.feedback : "";
    const progress = Math.round(((currentQuestionIndex + 1) / filteredQuestions.length) * 100);
    const scenario = getQuestionScenario(currentQuestion, selectedRole!, selectedLevel!);
    const checkpointSize = 4;
    const shouldShowCheckpoint = currentQuestionIndex > 0 && currentQuestionIndex % checkpointSize === 0 && currentQuestionIndex > lastCheckpointSeen;

    if (shouldShowCheckpoint) {
      const answeredSubset = filteredQuestions.slice(0, currentQuestionIndex);
      const interim = calculateResults(answeredSubset, answers);
      const answeredCount = answeredSubset.length;
      const topInterim = [...interim.normalized].sort((a, b) => b.percent - a.percent).slice(0, 3);

      return (
        <div className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
          <main className="relative mx-auto flex min-h-screen w-full max-w-5xl items-center px-4 py-8">
            <section className="w-full rounded-3xl border border-panelBorder bg-panel/90 p-8 shadow-premium">
              <p className="inline-flex rounded-full border border-cyan-400/40 bg-cyan-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-cyan-200">
                Промежуточный итог
              </p>
              <h2 className="mt-3 text-3xl font-semibold">Вы прошли {answeredCount} вопросов</h2>
              <p className="mt-2 text-slate-300">
                Текущий трек: {selectedTrackLabel}. Прогресс: {Math.round((answeredCount / filteredQuestions.length) * 100)}%.
              </p>

              <div className="mt-6 grid gap-4 md:grid-cols-3">
                {topInterim.map((item) => (
                  <div key={`interim-${item.category}`} className="rounded-xl border border-slate-700 bg-slate-900/70 p-4">
                    <p className="text-sm text-slate-300">{displayCategory(item.category)}</p>
                    <p className="mt-1 text-xl font-semibold text-white">{item.percent}%</p>
                    <p className={`mt-1 text-xs ${zoneColor(item.percent)}`}>{item.zone}</p>
                  </div>
                ))}
              </div>

              <div className="mt-8 flex justify-end">
                <button
                  type="button"
                  onClick={() => setLastCheckpointSeen(currentQuestionIndex)}
                  className="rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-6 py-2.5 text-sm font-semibold text-white"
                >
                  Продолжить
                </button>
              </div>
            </section>
          </main>
        </div>
      );
    }

    return (
      <div className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
        <main className="relative mx-auto flex min-h-screen w-full max-w-6xl items-stretch px-4 py-4 md:px-6 md:py-6">
          <section className="flex w-full flex-col rounded-3xl border border-panelBorder bg-panel/90 p-6 shadow-premium md:p-8">
            <div className="mb-6">
              <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-wide text-slate-400">
                <span>
                  Вопрос {currentQuestionIndex + 1}/{filteredQuestions.length}
                </span>
                <span>{progress}%</span>
              </div>
              {selectedTrackLabel ? <p className="mb-2 text-xs text-slate-400">Трек: {selectedTrackLabel}</p> : null}
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                <div className="h-full bg-gradient-to-r from-indigo-500 to-cyan-500" style={{ width: `${progress}%` }} />
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={resetAssessment}
                  className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                >
                  Начать заново
                </button>
              </div>
            </div>

            <p className="inline-flex w-fit rounded-full border border-indigo-400/40 bg-indigo-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-200">
              {displayCategory(currentQuestion.category)}
            </p>
            <div className="mt-4 rounded-2xl border border-indigo-400/30 bg-indigo-500/10 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-indigo-200">Сценарий кейса</p>
              <p className="mt-2 text-sm text-slate-200">{scenario.context}</p>
            </div>

            <div className="mt-4 space-y-3">
              {scenario.stakeholders.map((stakeholder, idx) => (
                <div key={`${currentQuestion.id}-stakeholder-${idx}`} className="flex items-start gap-3 rounded-xl border border-slate-700 bg-slate-900/70 p-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-600 bg-slate-800 text-lg">
                    {stakeholder.emoji}
                  </div>
                  <p className="text-sm text-slate-200">
                    <span className="font-semibold text-white">{stakeholder.role}:</span> {stakeholder.line}
                  </p>
                </div>
              ))}
            </div>
            <h2 className="mt-3 text-2xl font-semibold">{currentQuestion.question}</h2>

            <div className="mt-6 space-y-3">
              {currentQuestion.options.map((option, index) => {
                const isSelected = selectedOptionIndex === index;
                return (
                  <button
                    key={`${currentQuestion.id}-${index}`}
                    type="button"
                    onClick={() => selectAnswer(currentQuestion.id, index)}
                    className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                      isSelected
                        ? "border-indigo-400 bg-indigo-500/20 text-white"
                        : "border-slate-700 bg-slate-900/80 text-slate-300 hover:border-slate-500"
                    }`}
                  >
                    {option.text}
                  </button>
                );
              })}
            </div>

            {selectedFeedback ? (
              <div className="mt-5 rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-4">
                <p className="text-xs uppercase tracking-wide text-cyan-300">AI-ассистент</p>
                <p className="mt-2 text-sm text-slate-200">{selectedFeedback}</p>
              </div>
            ) : null}

            <div className="mt-auto flex items-center justify-between pt-6">
              <button
                type="button"
                disabled={currentQuestionIndex === 0}
                onClick={prevQuestion}
                className="rounded-xl border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-300 disabled:opacity-40"
              >
                Назад
              </button>
              <button
                type="button"
                onClick={nextQuestion}
                disabled={typeof selectedOptionIndex !== "number" || currentQuestionIndex >= filteredQuestions.length}
                className="rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {currentQuestionIndex === filteredQuestions.length - 1 ? "Завершить" : "Далее"}
              </button>
            </div>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      <div className="absolute left-0 top-0 h-72 w-72 rounded-full bg-indigo-500/20 blur-3xl" />
      <div className="absolute bottom-0 right-0 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />

      <main className="relative mx-auto flex min-h-screen max-w-4xl items-center px-4 py-12">
        <section className="w-full rounded-3xl border border-panelBorder bg-panel/90 p-8 shadow-premium backdrop-blur">
          <p className="mb-4 inline-flex rounded-full border border-indigo-400/40 bg-indigo-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-200">
            Платформа оценки навыков
          </p>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Начните оценку навыков</h1>
          <p className="mt-3 text-slate-300">Выбери роль и уровень, чтобы начать персонализированный skill-gaming сценарий.</p>

          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <div>
              <p className="mb-3 text-sm font-medium text-slate-300">Роль</p>
              <div className="space-y-3">
                {assessmentData.roles.map((role) => {
                  const active = selectedRole === role;
                  return (
                    <button
                      key={role}
                      type="button"
                      onClick={() => setRole(role)}
                      className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                        active ? "border-indigo-400 bg-indigo-500/20 text-white" : "border-slate-700 bg-slate-900/80 text-slate-300 hover:border-slate-500"
                      }`}
                    >
                      {roleLabels[role]}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="mb-3 text-sm font-medium text-slate-300">Уровень</p>
              <div className="space-y-3">
                {assessmentData.levels.map((level) => {
                  const active = selectedLevel === level;
                  return (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setLevel(level)}
                      className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                        active ? "border-cyan-400 bg-cyan-500/20 text-white" : "border-slate-700 bg-slate-900/80 text-slate-300 hover:border-slate-500"
                      }`}
                    >
                      {levelLabels[level]}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <button
            type="button"
            disabled={!canStart}
            onClick={startAssessment}
            className="mt-8 inline-flex min-w-52 items-center justify-center rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-6 py-3 font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Начать оценку
          </button>
        </section>
      </main>
    </div>
  );
}
