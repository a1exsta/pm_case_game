import { create } from "zustand";
import { persist } from "zustand/middleware";
import { assessmentData } from "../data/questions";

type Role = (typeof assessmentData.roles)[number];
type Level = (typeof assessmentData.levels)[number];

export type AnswerMap = Record<string, number>;

interface AssessmentState {
  selectedRole: Role | null;
  selectedLevel: Level | null;
  currentQuestionIndex: number;
  hasStarted: boolean;
  answers: AnswerMap;
  setRole: (role: Role) => void;
  setLevel: (level: Level) => void;
  startAssessment: () => void;
  selectAnswer: (questionId: string, optionIndex: number) => void;
  nextQuestion: () => void;
  prevQuestion: () => void;
  resetAssessment: () => void;
}

export const useAssessmentStore = create<AssessmentState>()(
  persist(
    (set) => ({
      selectedRole: null,
      selectedLevel: null,
      currentQuestionIndex: 0,
      hasStarted: false,
      answers: {},
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
