@must-fail
Feature: Assertions on the page, its views and its errors that must fail
  Each scenario asserts something that is not true of the demo, at its last step.

  @no-javascript
  Scenario: Without JavaScript nothing wires the page up
    Fails with: Expected the page to be wired up, but the browser has JavaScript off.
    Given I am on "/"
    Then the page should be wired up

  @needs-javascript
  Scenario: A page the server rendered
    Fails with: Expected the page to have been drawn in the browser only, but the server's HTML held it.
    Given I am on "/about"
    Then the page should have been drawn in the browser only

  @needs-javascript
  Scenario: A change of view in place
    Fails with: Expected the last navigation to have loaded a new page, but it changed the view in place.
    Given I am on "/"
    When I use the "About" link
    Then a new page should have loaded

  @no-javascript
  Scenario: A new page loaded
    Fails with: Expected the last navigation to have changed the view in place, but it loaded a new page.
    Given I am on "/"
    When I use the "About" link
    Then the view should have changed in place

  @needs-javascript
  Scenario: Another title
    Fails with: Expected the new view to be announced as "About", but the announcer says "Posts".
    Given I am on "/"
    When I use the "Posts" link
    Then the new view should be announced as "About"

  Scenario: Another link marked current
    Fails with: Expected the link "Contact" to be marked current, but it is not.
    Given I am on "/about"
    Then the "Contact" link should be marked current

  Scenario: Another address
    Fails with: Expected the view's address to be "/contact", but it is "/about".
    Given I am on "/about"
    Then the view's address should be "/contact"

  Scenario: A link the page does not have
    Fails with: Expected a link named "Pricing" on the page, but there is none.
    Given I am on "/"
    When I use the "Pricing" link

  Scenario: A page that is not an error page
    Fails with: Expected the view to be the 404 error page, but
    Given I am on "/about"
    Then the view should be the 404 error page

  Scenario: Another message of the error page
    Fails with: Expected the view to be the 404 error page saying "Server on fire", but it does not say "Server on fire".
    Given I am on "/posts/9"
    Then the view should be the 404 error page saying "Server on fire"
