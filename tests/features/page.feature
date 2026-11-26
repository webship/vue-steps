@page
Feature: The app wires the server's page up
  The demo: Nuxt's official starter with pages of its own. A page arrives as the server's HTML; the app's
  scripts then wire it up in the browser. One page is drawn in the browser only: the server sends an empty
  shell for it.

  @critical @needs-javascript
  Scenario: A page of the server is wired up by the app
    Given I am on "/"
    And the page is wired up
    Then the page should be wired up
    And I should see "Welcome to the demo"

  @needs-javascript
  Scenario: A page drawn in the browser only
    Given I am on "/client-only"
    And the page is wired up
    Then the page should have been drawn in the browser only
    And I should see "rendered in the browser"

  @no-javascript
  Scenario: Without JavaScript the server's page is all there is
    Given I am on "/posts"
    And the page is wired up
    Then I should see "Moving between pages"

  @needs-javascript @still-after-steps
  Scenario: A count that changes in place
    Given I am on "/"
    When I press "Add one to the count" by attr
    And I wait for the page to be still
    Then I should see "1" in the "#count" element
