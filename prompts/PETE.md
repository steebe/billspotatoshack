 Hi buddy. I'm back for more fun in this little repo. Let's add a new feature: A new game called "Pete" that is a
  clone of the Google Chrome Steve Dino game.

(https://en.wikipedia.org/wiki/Dinosaur_Game)

# Gameplay

The game should truly be a clone of The Dino Game:

- A simple 2D platformer in which the character being controlled
by the player is affixed to the LHS of the screen, and "moves"
to the right indefinitely, having to jump over objects in order
to "stay alive"

- The character in our case should be a Little Potato (Pete)

- The objects that Pete has to dodge should include:
    - On the ground:
        - "Static" Weeds
        - "Static" Herbicide Cans (indicated with a faux poison icon)
        - "Moving" Beetles
    - In the air:
        - "Moving" Birds (High)
        - "Moving" Birds (Low)

(where "Static" means that the asset matches the speed of the level,
and "Moving" means the asset approaches a little faster than
the level moves)

- The movement of the level should be tied to a global
score count, such that the farther the player makes it in thelevel
- The movevement of the level should speed up gradually as the player earns
more points, effectively ramping up the difficulty as they make
it farther in the level

## Mechanics

The only action the player needs to take is a "jump" mechanic to avoid ground enemies

The jump mechanic should be relatively responsive to how long the player held the jump
input; a long press should let Pete remain at max height slightly longer than a quick tap

# UI Design

The foreground and background should move separately, as in The Dino Game.

The UI should be loosely "pixely" as an homage to The Dino Game.

## Setting

- The UI of the setting should be a lush green farmland
- There should be a day/night setting like The Dino Game, such that after reaching a certain multiple of a distance threshold, the UI transitions from "day" to "night" and back again at the next multiple
- After the player reaches a certain points threshold in general,
the map should evolve into a "dry/arid" farmland to induce more of a
sense of urgency in the player

## Sprites

- Pete: The central character is Potato Pete, who should be a simple Potato sprite with one animation type: Jumping
- Enemies to dodge:
    - Weeds, at least two varieties - no animations
        - Small
        - Large, a little bulkier and taller, requiring more coordinated jumps
    - Beetles, with animations to make it appear that their legs move as they approach Pete
    - Birds, with animations to make it appear that their wings flap as they approach Pete
        - Some higher up in the "sky", requiring no action to go underneath; simply adding complexity to the level when combined with weeds
        - Others lower down, requiring jumping over






