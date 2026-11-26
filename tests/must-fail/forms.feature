@must-fail
Feature: Assertions on a form that must fail
  Each scenario asserts something that is not true of the demo's contact form, at its last step.

  Scenario: A message that went through
    Fails with: Expected the form to have been turned down with "Your name is required.", but it went through
    Given I am on "/contact"
    When I fill in "Your name" with "Ada"
    And I fill in "Your message" with "Hello from the scenarios of the pack."
    And I send the form with the "Send" button
    Then the form should have been turned down with "Your name is required."

  Scenario: A message that was turned down
    Fails with: Expected the form to have gone through, but the page says "Your message needs at least 10 characters."
    Given I am on "/contact"
    When I fill in "Your name" with "Ada"
    And I fill in "Your message" with "Too short"
    And I send the form with the "Send" button
    Then the form should have gone through

  Scenario: Turned down for another reason
    Fails with: Expected the form to have been turned down with "Your name is required.", but it says "Your message needs at least 10 characters."
    Given I am on "/contact"
    When I fill in "Your name" with "Ada"
    And I fill in "Your message" with "Too short"
    And I send the form with the "Send" button
    Then the form should have been turned down with "Your name is required."

  @needs-javascript
  Scenario: A form sent in place
    Fails with: Expected the form to have led to a new page, but it was sent in place.
    Given I am on "/contact"
    When I fill in "Your name" with "Ada"
    And I fill in "Your message" with "Hello from the scenarios of the pack."
    And I send the form with the "Send" button
    Then the form should have led to a new page

  @no-javascript
  Scenario: A form that led to a new page
    Fails with: Expected the form to have been sent in place, but it led to a new page.
    Given I am on "/contact"
    When I fill in "Your name" with "Ada"
    And I fill in "Your message" with "Hello from the scenarios of the pack."
    And I send the form with the "Send" button
    Then the form should have been sent in place

  Scenario: A button the form does not have
    Fails with: Expected a button named "Subscribe" in a form of the page, but there is none.
    Given I am on "/contact"
    When I send the form with the "Subscribe" button

  Scenario: No form sent yet
    Fails with: Expected a form the scenario sent, but none of its steps sent one.
    Given I am on "/contact"
    Then the form should have gone through
