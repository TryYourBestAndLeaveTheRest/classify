
const getGender = async (name) => {
  try {
    const response = await fetch(`https://api.genderize.io?name=${name}`);
    return response.json();
  } catch (error) {
    throw new Error('Genderize API request failed');
  }
};

const getAge = async (name) => {
  try {
    const response = await fetch(`https://api.agify.io?name=${name}`);
    return response.json();
  } catch (error) {
    throw new Error('Agify API request failed');
  }
};

const getNationality = async (name) => {
  try {
    const response = await fetch(`https://api.nationalize.io?name=${name}`);
    return response.json();
  } catch (error) {
    throw new Error('Nationalize API request failed');
  }
};

module.exports = {
  getGender,
  getAge,
  getNationality,
};