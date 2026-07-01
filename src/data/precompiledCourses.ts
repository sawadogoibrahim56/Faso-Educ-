import { Level } from '../types';

export interface CourseData {
  id: string;
  title: string;
  category: string;
  subject: string;
  level: Level;
  description: string;
  chapters: {
    title: string;
    content: string;
    summary?: string;
  }[];
  userEmail?: string;
  isPublic?: boolean;
}

export const precompiledCourses: CourseData[] = [];
