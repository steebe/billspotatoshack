# CATCH

A simple browser game that requires the user to catch potatoes in a basket.

## Controls

Mouse movement should move the basket, as would A/D and Left/Right arrow keys.

## Behavior

- Potatoes drop from the top of the screen, and the user must catch them in
their "basket"
    - There are three types of potatoes:
        - Russets - standard size, brown potatoes
        - Yukon - standard size, yukon colored
        - "Golden Yukon" - small, shiny versions of the Yukon
- Carrots also drop from the top of the screen, and the user must avoid catching
them

#### Mechanics

- Each drop item type is subject to random fall speeds
- Golden Yukons drop, on average, faster than all other potatoes
- Catching a Russet or Yukon earns the player one point
- Catching a Golden Yukon earns the player 3 points


## Progression

## Loss condition

If the player fails to catch more than three potatoes, they lose.

If the player accidentally catches three or more carrots, they lose.

## Win condition

The first version of the game simply requires that the user earn 50 points.
