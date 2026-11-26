@views
Feature: The app's views
  A link of a page the app has wired up changes the view inside the page: the router's navigation ends, the
  route announcer says the new view's title, and the link of the current view is marked. The data of a view
  is fetched during its navigation. Without JavaScript every link loads a new page.

  @critical @needs-javascript
  Scenario: A link changes the view in place, and the new view is announced
    Given I am on "/"
    When I use the "Posts" link
    Then the view should have changed in place
    And the new view should be announced as "Posts"
    And the "Posts" link should be marked current
    And the view's address should be "/posts"
    And I should see "Moving between pages"

  @needs-javascript
  Scenario: A view with data of its own, and the browser's back
    Given I am on "/posts"
    When I use the "Moving between pages" link
    Then the view should have changed in place
    And the new view should be announced as "Moving between pages"
    And the view's address should be "/posts/2"
    When I return to the previous view
    Then the view should have changed in place
    And the view's address should be "/posts"

  @needs-javascript
  Scenario: Data loaded again in the view
    Given I am on "/posts"
    When I press "Load the posts again"
    And I wait for the view's data to arrive
    Then I should see "success" in the "#status" element

  # A link whose view the app redirects: a route middleware sends /posts/latest on to the latest post. The router
  # runs its guards once for each address, and the steps follow the navigation to its last one.
  @needs-javascript
  Scenario: A link whose view the app redirects changes the view in place, to where it was sent
    Given I am on "/posts"
    When I use the "The latest post" link
    Then the view should have changed in place
    And the view's address should be "/posts/3"
    And the new view should be announced as "Forms"

  @no-javascript
  Scenario: Without JavaScript a redirected link loads the page it was sent to
    Given I am on "/posts"
    When I use the "The latest post" link
    Then a new page should have loaded
    And the view's address should be "/posts/3"

  @no-javascript
  Scenario: Without JavaScript every link loads a new page
    Given I am on "/"
    When I use the "About" link
    Then a new page should have loaded
    And the "About" link should be marked current
