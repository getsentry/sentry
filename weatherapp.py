#create a weather app: --

from tkinter import *
from tkinter import ttk
import requests
def data_get():
   city=city_name.get()
   data=requests.get("https://api.openweathermap.org/data/2.5/weather?q="+city+"&appid=20a01944eda34a13f4a4dcecfff77197").json()
  
   w_lab1.config(text=data['weather'][0]['main'])
   wb_lab1.config(text=data['weather'][0]['description'])
   t_lab1.config(text=str(int(data['main']['temp']-273.15)))
   p_lab.config(text=data['main']['pressure'])
   

#combobox
win=Tk()
win.title("Weather App")
win.config(bg='pink')
win.geometry('500x570')
name_lab=Label(win,text="Weather Python App",font=("Time New Roman",30,'bold'))
name_lab.place(x=25,y=50,height=50,width=450)


list_name=["Andhra Pradesh","Arunachal Pradesh ","Assam","Bihar","Chhattisgarh","Goa","Gujarat","Haryana","Himachal Pradesh","Jammu and Kashmir","Jharkhand","Karnataka","Kerala","Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana","Tripura","Uttar Pradesh","Uttarakhand","West Bengal","Andaman and Nicobar Islands","Chandigarh","Dadra and Nagar Haveli","Daman and Diu","Lakshadweep","National Capital Territory of Delhi","Puducherry"]
city_name=StringVar()
com=ttk.Combobox(win,text="Weather Python App",values=list_name,font=("Time New Roman",20,'bold'),textvariable=city_name)
com.place(x=25,y=120,height=50,width=450)
w_lab=Label(win,text="Weather Climate",font=("Time New Roman",20))
w_lab.place(x=25,y=260,height=50,width=210)
w_lab1=Label(win,text=" ",font=("Time New Roman",20))
w_lab1.place(x=250,y=260,height=50,width=210)


wb_lab=Label(win,text="Weather Description",font=("Time New Roman",17))
wb_lab.place(x=25,y=330,height=50,width=210)
wb_lab1=Label(win,text=" ",font=("Time New Roman",17))
wb_lab1.place(x=250,y=330,height=50,width=210)

temp_lab=Label(win,text="Teamprature",font=("Time New Roman",20))
temp_lab.place(x=25,y=400,height=50,width=210)
t_lab1=Label(win,text=" ",font=("Time New Roman",17))
t_lab1.place(x=250,y=400,height=50,width=210)
press_lab=Label(win,text="Pressure",font=("Time New Roman",20))
press_lab.place(x=25,y=470,height=50,width=210)
p_lab=Label(win,text=" ",font=("Time New Roman",17))
p_lab.place(x=250,y=470,height=50,width=210)
done_button=Button(win,text="Done",font=("Time New Roman",30,'bold'),command=data_get)
done_button.place(y=190,height=50,width=100,x=200)

win.mainloop()

