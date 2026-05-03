import { describe, it, expect } from 'vitest';
import { calculateBMR, calculateTargetCalories, getFullCalorieTarget } from './calorieCalc';

describe('Calorie Calculation Utility', () => {
  it('should appropriately calculate BMR for a Male', () => {
    // 30 yo male, 180cm, 80kg
    // BMR = 88.362 + (13.397 * 80) + (4.799 * 180) - (5.677 * 30) = 1853.63
    const bmr = calculateBMR('Male', 80, 180, 30);
    expect(Math.round(bmr)).toBe(1854);
  });

  it('should calculate TDEE and adjust for Weight Loss', () => {
    // bmr 1854, Sedentary -> TDEE = 1854 * 1.2 = 2224.8
    // Weight Loss -> 2225 - 500 = 1725 target
    const target = getFullCalorieTarget('Male', 80, 180, 30, 'Sedentary', 'Weight Loss');
    expect(target).toBe(1724); // Based on exact float calculation (1853.63 * 1.2) - 500
  });

  it('should adjust correctly for Muscle Gain', () => {
    // bmr 1854, Moderately Active -> TDEE = 1853.63 * 1.55 = 2873.1
    // Muscle gain -> 2873 + 300 = 3173
    const target = getFullCalorieTarget('Male', 80, 180, 30, 'Moderately Active', 'Muscle Gain');
    expect(target).toBe(3173);
  });
});
