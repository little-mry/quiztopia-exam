export type NewQuizBody = {
  quizname: string;
  city: string;
};

export type NewQuestionBody = {
  question: string;
  answer: string;
  location: {
    longitude: number;
    latitude: number;
  };
};
