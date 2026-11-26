@errors
Feature: Error pages
  A view whose data is missing, and an address the app does not know, show the app's error page, with the
  status in its first heading and the message under it; reached inside the app too.

  @critical
  Scenario: A post that does not exist
    Given I am on "/posts/9"
    Then the view should be the 404 error page saying "Post not found"

  Scenario: An address the app does not know
    Given I am on "/no-such-page"
    Then the view should be the 404 error page saying "Page not found"
    And the response status code should be 404
