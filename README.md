# Decision trees simulator

Web link: https://gadea-lucas.github.io/decision-trees-simulator-teachers/

This repository extends the original Decision Trees Simulator project available at [this link](https://github.com/danieldf01/TFG-decision-trees-sim) (Web link: https://admirable-ubu.github.io/decision-trees-simulator/).


The original project was developed as a final degree project for the course Ingeniería Informática at the University of Burgos and focuses on teaching the fundamentals of decision tree creation, particularly the ID3 algorithm, through interactive visualizations.

This repository builds upon that work by adding assessment-oriented features, aimed at supporting learning evaluation in virtual learning environments such as Moodle.

## Description

The original project had the following functiolalities:

* Entropy calculator:
  The entropy calculator teaches the concept of entropy (in the context of information theory) to the user by not only providing general information and its formula, but also letting them calculate the entropy for self-chosen values.
* Conditional Entropy calculator:
  Much like the Entropy calculator, the Conditional Entropy calculator teaches the concept of conditional entropy by providing information and the ability to calculate it for a dataset of user-chosen values.
* Step-by-step visualization of the ID3 algorithm:
  This part of the application contains all necessary information about the decision trees and the ID3 algorithm alongside a step-by-step visualization of the creation process of a decision tree.  
  The user is free to choose between different example datasets and using their own example dataset in the CSV file format.

In addition to all the functionalities provided by the original Decision Trees Simulator, this extension introduces:

* Moodle Cloze quiz export:
The application allows users to generate Cloze-type questions directly exportable and importable into Moodle, enabling the creation of exams and self-assessment activities related to ID3 decision trees.
* Interactive quiz configuration menus:
New interactive menus let instructors customize how questions are generated, allowing control over aspects such as question structure and content derived from the decision tree.
* Onboarding tutorial added.

## Authors

Daniel Drefs Fernandes, Carlos López Nozal, Ismael Ramos Pérez, Pedro Latorre Carmona y Gadea Lucas Pérez.

## Acknowledgments

This project was influenced by the final project "[Web Thoth](http://cgosorio.es/Seshat/)" of tutor Ismael Ramos Pérez.
