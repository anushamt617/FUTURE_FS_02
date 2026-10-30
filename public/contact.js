const contactForm = document.getElementById('contactForm');
const feedback = document.getElementById('feedback');

contactForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!contactForm.reportValidity()) return;
  const submitButton = contactForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  feedback.textContent = 'Submitting…';
  const payload = Object.fromEntries(new FormData(contactForm).entries());
  try {
    const response = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Could not submit enquiry.');
    feedback.textContent = result.message;
    contactForm.reset();
  } catch (error) {
    feedback.textContent = error.message || 'Network error. Please try again.';
  } finally {
    submitButton.disabled = false;
  }
});
