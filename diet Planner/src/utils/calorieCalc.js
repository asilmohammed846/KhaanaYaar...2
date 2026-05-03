// Utility to calculate Basal Metabolic Rate (BMR) and daily calorie target
// Using the Harris-Benedict Equation

export function calculateBMR(gender, weight, height, age) {
  if (!weight || !height || !age) return 0;
  
  if (gender === 'Male') {
    return 88.362 + (13.397 * weight) + (4.799 * height) - (5.677 * age);
  } else {
    // Female or Other (fallback to female formula for conservative estimate)
    return 447.593 + (9.247 * weight) + (3.098 * height) - (4.330 * age);
  }
}

export function calculateDailyTDEE(bmr, activityLevel) {
  const multipliers = {
    'Sedentary': 1.2,
    'Lightly Active': 1.375,
    'Moderately Active': 1.55,
    'Very Active': 1.725,
    'Super Active': 1.9
  };
  return bmr * (multipliers[activityLevel] || 1.2);
}

export function calculateTargetCalories(tdee, goal) {
  // Goal modifier
  switch (goal) {
    case 'Weight Loss':
      return Math.round(tdee - 500); // 500 deficit
    case 'Muscle Gain':
      return Math.round(tdee + 300); // 300 surplus
    case 'Maintenance':
    default:
      return Math.round(tdee);
  }
}

export function getFullCalorieTarget(gender, weight, height, age, activityLevel, goal) {
  const bmr = calculateBMR(gender, weight, height, age);
  const tdee = calculateDailyTDEE(bmr, activityLevel);
  return calculateTargetCalories(tdee, goal);
}
