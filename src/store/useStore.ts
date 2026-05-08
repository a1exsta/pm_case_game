import { create } from "zustand";
import { persist } from "zustand/middleware";
import { assessmentData } from "../data/questions";

type Role = (typeof assessmentData.roles)[number];
type Level = (typeof assessmentData.levels)[number];

export type AnswerMap = Record<string, number>;
export type CategoryScoreMap = Record<string, number>;

const MS_IN_DAY = 24 * 60 * 60 * 1000;

function getDateStart(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function calculateNextStreak(lastCompletedDate: string | null) {
  if (!lastCompletedDate) return 1;
  const today = getDateStart(new Date());
  const last = getDateStart(new Date(lastCompletedDate));
  const diffDays = Math.round((today.getTime() - last.getTime()) / MS_IN_DAY);
  if (diffDays === 0) return null; // already counted for today
  if (diffDays === 1) return "increment";
  return "reset";
}

interface AssessmentState {
  playerId: string;
  displayName: string;
  selectedRole: Role | null;
  selectedLevel: Level | null;
  currentQuestionIndex: number;
  hasStarted: boolean;
  answers: AnswerMap;
  totalXp: number;
  streakDays: number;
  lastCompletedDate: string | null;
  unlockedAchievementIds: string[];
  previousCategoryScores: CategoryScoreMap | null;
  setDisplayName: (name: string) => void;
  setRole: (role: Role) => void;
  setLevel: (level: Level) => void;
  startAssessment: () => void;
  selectAnswer: (questionId: string, optionIndex: number) => void;
  awardXp: (amount: number) => void;
  registerCompletion: (scores: CategoryScoreMap, achievementIds: string[]) => void;
  nextQuestion: () => void;
  prevQuestion: () => void;
  resetAssessment: () => void;
}

export const useAssessmentStore = create<AssessmentState>()(
  persist(
    (set) => ({
      playerId: typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `player-${Date.now()}`,
      displayName: "",
      selectedRole: null,
      selectedLevel: null,
      currentQuestionIndex: 0,
      hasStarted: false,
      answers: {},
      totalXp: 0,
      streakDays: 0,
      lastCompletedDate: null,
      unlockedAchievementIds: [],
      previousCategoryScores: null,
      setDisplayName: (name) => set({ displayName: name }),
      setRole: (role) => set({ selectedRole: role }),
      setLevel: (level) => set({ selectedLevel: level }),
      startAssessment: () => set({ currentQuestionIndex: 0, hasStarted: true, answers: {} }),
      selectAnswer: (questionId, optionIndex) =>
        set((state) => ({
          answers: {
            ...state.answers,
            [questionId]: optionIndex,
          },
        })),
      awardXp: (amount) => set((state) => ({ totalXp: state.totalXp + Math.max(0, amount) })),
      registerCompletion: (scores, achievementIds) =>
        set((state) => {
          const streakAction = calculateNextStreak(state.lastCompletedDate);
          const nextStreak =
            streakAction === null ? state.streakDays : streakAction === "increment" ? state.streakDays + 1 : 1;
          return {
            streakDays: nextStreak,
            lastCompletedDate: new Date().toISOString(),
            previousCategoryScores: scores,
            unlockedAchievementIds: Array.from(new Set([...state.unlockedAchievementIds, ...achievementIds])),
          };
        }),
      nextQuestion: () => set((state) => ({ currentQuestionIndex: state.currentQuestionIndex + 1 })),
      prevQuestion: () => set((state) => ({ currentQuestionIndex: Math.max(0, state.currentQuestionIndex - 1) })),
      resetAssessment: () =>
        set({
          selectedRole: null,
          selectedLevel: null,
          currentQuestionIndex: 0,
          hasStarted: false,
          answers: {},
        }),
    }),
    {
      name: "assessment-storage",
    },
  ),
);
