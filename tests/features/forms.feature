@forms
Feature: A form, with JavaScript and without
  The demo's contact form posts to a server route without JavaScript, and the server sends the browser back
  to the form with the answer in its address; with JavaScript the app sends it in place and shows the
  answer. The same steps run in both: each waits for what its mode brings.

  @critical
  Scenario: A message is taken
    Given I am on "/contact"
    When I fill in "Your name" with "Ada"
    And I fill in "Your message" with "Hello from the scenarios of the pack."
    And I send the form with the "Send" button
    Then the form should have gone through
    And I should see "Thanks, Ada: your message was sent."

  Scenario: A message too short is turned down, and says why
    Given I am on "/contact"
    When I fill in "Your name" with "Ada"
    And I fill in "Your message" with "Too short"
    And I send the form with the "Send" button
    Then the form should have been turned down with "Your message needs at least 10 characters."

  @needs-javascript
  Scenario: With JavaScript, the form is sent in place
    Given I am on "/contact"
    When I fill in "Your name" with "Ada"
    And I fill in "Your message" with "Hello from the scenarios of the pack."
    And I send the form with the "Send" button
    Then the form should have been sent in place

  @no-javascript
  Scenario: Without JavaScript, the form leads to a new page
    Given I am on "/contact"
    When I fill in "Your name" with "Ada"
    And I fill in "Your message" with "Hello from the scenarios of the pack."
    And I send the form with the "Send" button
    Then the form should have led to a new page
    And the view's address should be "/contact?sent=Ada"
